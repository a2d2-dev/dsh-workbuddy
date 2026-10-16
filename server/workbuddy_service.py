"""Control-plane extension around the pinned workbuddy2api protocol implementation."""
import logging
import os
from pathlib import Path
import sys

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

upstream_path = Path(os.environ["WORKBUDDY_PROXY_SOURCE"]).resolve()
sys.path.insert(0, str(upstream_path / "server"))
import codebuddy_proxy as proxy
from session import Account, ManagedClient
from protocol import IsolatedProxyState

logger = logging.getLogger("workbuddy.service")


class LoginBody(BaseModel):
    """Bound the opaque login identifier accepted by the control plane."""
    loginId: str = Field(min_length=16, max_length=128)


def create_app() -> FastAPI:
    """Build the service using deployment environment variables and existing credentials."""
    client = ManagedClient(os.environ["WORKBUDDY_ENDPOINT"], Path(os.environ["WORKBUDDY_SESSION_FILE"]))
    account = Account(client, int(os.environ["WORKBUDDY_LOGIN_TTL_SECONDS"]))
    proxy.proxy_state = IsolatedProxyState(client=client, mock_dir=None,
        log_file=Path(os.environ["WORKBUDDY_LOG_FILE"]),
        logger=proxy.setup_logging(Path(os.environ["WORKBUDDY_LOG_FILE"]).parent))
    app = FastAPI(title="DSH WorkBuddy Gateway", docs_url=None, redoc_url=None)
    register_routes(app, account)
    app.add_exception_handler(Exception, failure)
    app.mount("/", proxy.app)
    return app


def register_routes(app: FastAPI, account: Account) -> None:
    """Register account controls before the maintained model API application's mount."""
    @app.get("/workbuddy/status")
    def status():
        """Return account identity and the number of live chat models, never credentials."""
        if not account.client.session.get("auth", {}).get("accessToken"):
            return {"connected": False, "account": "", "models": 0}
        try:
            models = account.catalog()
        except HTTPException as error:
            if error.status_code != 401:
                raise
            return {"connected": False, "account": "", "models": 0}
        identity = account.client.session.get("account") or {}
        return {"connected": True, "account": str(identity.get("nickname") or identity.get("uid") or ""), "models": len(models)}

    @app.get("/workbuddy/models")
    @app.get("/v1/models")
    def models():
        """Discover sanitized model capabilities from the authorized upstream account."""
        if not account.client.session.get("auth", {}).get("accessToken"):
            return {"object": "list", "data": []}
        return {"object": "list", "data": account.catalog()}

    @app.post("/workbuddy/connect/start")
    def start():
        """Create an authorization link consumed by the DSH settings section."""
        return account.start()

    @app.post("/workbuddy/connect/finish")
    def finish(body: LoginBody):
        """Poll the browser-bound pending login without returning its tokens."""
        return account.finish(body.loginId)

    @app.post("/workbuddy/logout")
    def logout():
        """Clear this service's account and pending authorization."""
        return account.logout()


async def failure(request, error):
    """Log only the failure class; upstream errors can contain sensitive responses."""
    from fastapi.responses import JSONResponse
    logger.error("WorkBuddy control request failed: %s", type(error).__name__)
    return JSONResponse({"error": "WorkBuddy upstream request failed"}, status_code=502)
