"""Exercise authorization persistence without contacting a real account."""
from pathlib import Path
import threading
import time

from fastapi import HTTPException
import pytest
from session import Account, ManagedClient, public_model
from codebuddy_client_demo import CodeBuddyError
from protocol import IsolatedProxyState


class FakeClient:
    """Minimal upstream behavior for browser polling and token installation tests."""

    def __init__(self, path):
        self.lock = threading.RLock()
        self.session_file = path
        self.session = {}
        self.ready = False

    def _request(self, method, path, **kwargs):
        if "/auth/state" in path:
            return {"state": "upstream-state", "authUrl": "https://www.workbuddy.ai/login?state=upstream-state"}
        if "/auth/token?" in path:
            return {"accessToken": "private-token"} if self.ready else {}
        if "/login/account" in path:
            return {"uid": "account-id", "nickname": "Account"}
        raise AssertionError(path)

    def _unwrap(self, value):
        return value

    def _token_headers(self, token):
        return {"Authorization": "Bearer " + token["accessToken"]}

    def _save_session(self, session):
        self.session = session


def test_login_polling_is_single_use_and_never_returns_tokens(tmp_path):
    """Uncompleted authorization cannot install credentials; completion cannot replay."""
    client = FakeClient(tmp_path / "session.json")
    account = Account(client, 300)
    started = account.start()
    assert account.finish(started["loginId"]) == {"connected": False}
    assert client.session == {}
    client.ready = True
    assert account.finish(started["loginId"]) == {"connected": True}
    assert client.session["auth"]["accessToken"] == "private-token"
    with pytest.raises(HTTPException) as error:
        account.finish(started["loginId"])
    assert error.value.status_code == 410


def test_wrong_login_does_not_consume_authorization(tmp_path):
    """A wrong opaque identifier must not consume the owner's pending login."""
    account = Account(FakeClient(tmp_path / "session.json"), 300)
    started = account.start()
    with pytest.raises(HTTPException):
        account.finish("different-login")
    assert account.pending["id"] == started["loginId"]


def test_session_is_atomic_private_and_can_be_removed(tmp_path):
    """The saved record survives reload and logout removes both memory and disk state."""
    path = tmp_path / "session.json"
    client = ManagedClient("https://www.workbuddy.ai", path)
    client._save_session({"auth": {"accessToken": "private-token", "expiresAt": int(time.time() * 1000) + 120000}})
    assert path.stat().st_mode & 0o777 == 0o600
    assert ManagedClient("https://www.workbuddy.ai", path).session == client.session
    assert Account(client, 300).logout() == {"connected": False}
    assert not path.exists()
    assert client.session == {}


def test_catalog_does_not_expose_upstream_credentials():
    """Only account capabilities cross the gateway boundary."""
    result = public_model({"id": "model", "maxAllowedSize": 1000000, "maxOutputTokens": 128000,
                           "apiKey": "secret", "url": "https://private.test", "headers": {"Authorization": "secret"}})
    assert "apiKey" not in result and "url" not in result and "headers" not in result
    assert result["contextWindow"] == 1000000


def test_dsh_chats_never_share_implicit_upstream_continuations(tmp_path):
    """Identical model/system/tool shapes must still isolate independent requests."""
    state = IsolatedProxyState(FakeClient(tmp_path / "session.json"), None, None)
    body = {"model": "same-model", "messages": [{"role": "system", "content": "same-system"}]}
    first = state.get_conversation_id(body)
    second = state.get_conversation_id(body)
    assert first != second
    state.record_response_id(first, "prior-response")
    assert state.peek_previous_response_id(first) is None
    assert state.peek_previous_response_id(second) is None


def test_refresh_failure_preserves_transient_errors_and_clears_revoked_auth(tmp_path, monkeypatch):
    """Expired credentials are a sign-in state; transient upstream failures remain errors."""
    client = ManagedClient("https://www.workbuddy.ai", tmp_path / "session.json")
    client._save_session({"auth": {"accessToken": "expired", "expiresAt": 1, "refreshToken": "refresh"}})
    def unavailable():
        raise CodeBuddyError("HTTP 503 /token/refresh: unavailable")
    monkeypatch.setattr(client, "refresh", unavailable)
    with pytest.raises(CodeBuddyError):
        client.ensure_authenticated()
    assert client.session["auth"]["refreshToken"] == "refresh"
    def revoked():
        raise CodeBuddyError("HTTP 401 /token/refresh: rejected")
    monkeypatch.setattr(client, "refresh", revoked)
    with pytest.raises(HTTPException) as error:
        client.ensure_authenticated()
    assert error.value.status_code == 401
    assert client.session == {}
