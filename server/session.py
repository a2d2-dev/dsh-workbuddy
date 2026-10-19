"""Account authorization using the maintained proxy's WorkBuddy client."""
import json
import os
from pathlib import Path
import secrets
import threading
import time
from urllib.parse import quote, urlparse

from fastapi import HTTPException
from codebuddy_client_demo import CodeBuddyClient, CodeBuddyError
from codebuddy_proxy import official_ide_headers
from pricing import billing

NO_AUTH = {"X-No-Authorization": "true", "X-No-User-Id": "true",
           "X-No-Enterprise-Id": "true", "X-No-Department-Info": "true"}


class ManagedClient(CodeBuddyClient):
    """Keep token refresh serialized, atomic, and independent of a desktop browser."""

    def __init__(self, endpoint: str, session_file: Path):
        """Initialize the existing client and its refresh lock."""
        self.lock = threading.RLock()
        super().__init__(endpoint, platform="workbuddy-ai", session_file=session_file)

    def _save_session(self, session: dict) -> None:
        """Atomically persist the full credential record without exposing its contents."""
        self.session_file.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.session_file.with_name(self.session_file.name + "." + secrets.token_hex(8))
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                json.dump(session, stream)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, self.session_file)
            self.session = session
        finally:
            temporary.unlink(missing_ok=True)

    def ensure_authenticated(self, *, open_browser: bool = False) -> None:
        """Refresh an expiring token; require DSH sign-in instead of opening a browser."""
        with self.lock:
            auth = self.session.get("auth") or {}
            if auth.get("accessToken") and int(auth.get("expiresAt") or 0) > time.time() * 1000 + 60000:
                return
            try:
                refreshed = self.refresh()
            except CodeBuddyError as error:
                if not str(error).startswith(("HTTP 401 ", "HTTP 403 ")):
                    raise
                refreshed = False
            if not refreshed:
                self._save_session({})
                raise HTTPException(401, "Connect WorkBuddy from DSH Settings")


class Account:
    """Own the single active account and short-lived browser authorization state."""

    def __init__(self, client: ManagedClient, login_ttl: int):
        """Store the client and configured authorization lifetime in seconds."""
        self.client = client
        self.login_ttl = login_ttl
        self.pending: dict | None = None

    def request(self, method: str, path: str, **kwargs):
        """Return the unwrapped upstream JSON for a fixed account-protocol path."""
        return self.client._unwrap(self.client._request(method, path, **kwargs))

    def start(self) -> dict:
        """Create one pending login and return only the browser authorization URL."""
        with self.client.lock:
            if self.pending and self.pending["expires"] > time.monotonic():
                raise HTTPException(409, "A WorkBuddy login is already pending")
            payload = self.request("POST", "/v2/plugin/auth/state?platform=workbuddy-ai", headers=NO_AUTH, body={})
            if not isinstance(payload, dict) or not payload.get("state") or not payload.get("authUrl"):
                raise ValueError("Invalid WorkBuddy authorization response")
            target = urlparse(payload["authUrl"])
            if target.scheme != "https" or target.netloc not in ("www.workbuddy.ai", "www.codebuddy.ai"):
                raise ValueError("Unexpected WorkBuddy authorization origin")
            self.pending = {"id": secrets.token_urlsafe(32), "state": str(payload["state"]),
                            "expires": time.monotonic() + self.login_ttl}
            return {"loginId": self.pending["id"], "authorizationUrl": payload["authUrl"]}

    def finish(self, login_id: str) -> dict:
        """Poll the matching login once; install credentials only after account validation."""
        with self.client.lock:
            pending = self.pending
            if not pending or not secrets.compare_digest(login_id, pending["id"]) or pending["expires"] <= time.monotonic():
                raise HTTPException(410, "WorkBuddy login expired")
            suffix = "?state=" + quote(pending["state"], safe="")
            token = self.request("GET", "/v2/plugin/auth/token" + suffix, headers=NO_AUTH)
            if not isinstance(token, dict) or not token.get("accessToken"):
                return {"connected": False}
            headers = {key: value for key, value in NO_AUTH.items() if key != "X-No-Authorization"}
            headers.update(self.client._token_headers(token))
            account = self.request("GET", "/v2/plugin/login/account" + suffix, headers=headers)
            if not isinstance(account, dict) or not account.get("uid"):
                raise ValueError("Invalid WorkBuddy account response")
            self.client._save_session({"auth": token, "account": account})
            self.pending = None
            return {"connected": True}

    def logout(self) -> dict:
        """Remove local authorization; this does not revoke other logged-in devices."""
        with self.client.lock:
            self.client.session_file.unlink(missing_ok=True)
            self.client.session = {}
            self.pending = None
        return {"connected": False}

    def catalog(self) -> list[dict]:
        """Fetch account-specific model metadata, excluding non-chat models and secrets."""
        with self.client.lock:
            self.client.ensure_authenticated()
            headers = {**official_ide_headers("default-model", secrets.token_hex(16), "workbuddy-ai"),
                       **self.client.auth_headers()}
            config = self.request("GET", "/v3/config?repos=", headers=headers)
            if not isinstance(config, dict) or not isinstance(config.get("models"), list):
                raise ValueError("Invalid WorkBuddy model configuration")
            promotions = config.get("modelPromotions") or []
            if not isinstance(promotions, list):
                raise ValueError("Invalid WorkBuddy promotions")
            return [public_model(model, promotions) for model in config["models"]
                    if isinstance(model, dict) and model.get("supportsToolCall") is True]


def public_model(model: dict, promotions: list | None = None) -> dict:
    """Return only metadata needed by the DSH model selector and pi-ai adapter."""
    reasoning = model.get("reasoning") or {}
    efforts = reasoning.get("supportedEfforts", []) if isinstance(reasoning, dict) else []
    if not efforts and isinstance(reasoning, dict) and reasoning.get("effort"):
        efforts = [reasoning["effort"]]
    if not isinstance(efforts, list):
        raise ValueError("Invalid WorkBuddy reasoning capabilities")
    return {"id": model["id"], "name": model.get("name", model["id"]),
            "description": str(model.get("descriptionEn") or model.get("descriptionZh") or "")[:1000],
            "descriptionZh": str(model.get("descriptionZh") or model.get("descriptionEn") or "")[:1000],
            "billing": billing(model, promotions or []),
            "contextWindow": model["maxAllowedSize"], "maxTokens": model["maxOutputTokens"],
            "supportsImages": model.get("supportsImages") is True,
            "reasoningEfforts": efforts if model.get("supportsReasoning") is True else []}
