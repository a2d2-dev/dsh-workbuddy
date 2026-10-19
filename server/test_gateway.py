"""Exercise the shipped Caddy configuration against a real local HTTP backend, without an account."""
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import threading
import time

import httpx
import pytest


class EchoHandler(BaseHTTPRequestHandler):
    """Return only the synthetic Authorization header observed by the test backend."""

    def do_GET(self):
        """Respond to a test request; return None after writing the JSON result."""
        payload = json.dumps({"authorization": self.headers.get("Authorization")}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_POST = do_GET

    def log_message(self, format, *args):
        """Suppress request logging so synthetic credentials stay out of captured logs."""
        return None


@pytest.fixture
def backend():
    """Yield a loopback backend address; always stop and join its HTTP server thread."""
    server = ThreadingHTTPServer(("127.0.0.1", 0), EchoHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def wait_for_gateway(process, base_url):
    """Wait for a child listener; raise if it exits or does not become ready within five seconds."""
    deadline = time.monotonic() + 5
    with httpx.Client(trust_env=False, timeout=0.25) as client:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError("Caddy exited before accepting test requests")
            try:
                client.get(base_url + "/health")
                return
            except httpx.TransportError:
                time.sleep(0.05)
    raise RuntimeError("Caddy did not start within five seconds")


@contextmanager
def gateway(backend_address, key):
    """Yield a real Caddy URL for the backend/key; terminate the child on every exit path."""
    executable = shutil.which("caddy")
    if not executable:
        pytest.skip("Install Caddy to run gateway integration tests")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    base_url = f"http://127.0.0.1:{port}"
    environment = {**os.environ, "WORKBUDDY_GATEWAY_ADDRESS": base_url,
                   "WORKBUDDY_GATEWAY_BIND": "127.0.0.1", "WORKBUDDY_BACKEND_ADDR": backend_address}
    environment.pop("WORKBUDDY_GATEWAY_KEY", None)
    if key is not None:
        environment["WORKBUDDY_GATEWAY_KEY"] = key
    config = Path(__file__).resolve().parents[1] / "deploy" / "Caddyfile"
    process = subprocess.Popen([executable, "run", "--config", str(config), "--adapter", "caddyfile"],
                               env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_for_gateway(process, base_url)
        yield base_url
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def test_gateway_authenticates_and_strips_credentials_for_every_route(backend):
    """Given the actual gateway config, reject missing/wrong keys and strip valid keys on all paths."""
    key = secrets.token_urlsafe(32)
    paths = ["/health", "/workbuddy/status", "/workbuddy/models", "/v1/models", "/v1/credits", "/unknown"]
    posts = ["/v1/chat/completions", "/workbuddy/connect/start", "/workbuddy/connect/finish", "/workbuddy/logout"]
    with gateway(backend, key) as base_url, httpx.Client(base_url=base_url, trust_env=False, timeout=2) as client:
        for method, path in [("GET", path) for path in paths] + [("POST", path) for path in posts]:
            assert client.request(method, path).status_code == 401
            assert client.request(method, path, headers={"Authorization": "Bearer incorrect"}).status_code == 401
            response = client.request(method, path, headers={"Authorization": "Bearer " + key})
            assert response.status_code == 200
            assert response.json() == {"authorization": None}


@pytest.mark.parametrize("key", [None, ""])
def test_gateway_denies_access_without_a_configured_secret(backend, key):
    """Given a missing or empty environment key, deny even a matching empty bearer header."""
    with gateway(backend, key) as base_url, httpx.Client(base_url=base_url, trust_env=False, timeout=2) as client:
        assert client.get("/health").status_code == 401
        assert client.get("/health", headers={"Authorization": "Bearer"}).status_code == 401


def test_gateway_adapted_configuration_does_not_embed_the_secret(backend):
    """Given a configured key, keep it in runtime placeholders rather than the persisted JSON config."""
    executable = shutil.which("caddy")
    if not executable:
        pytest.skip("Install Caddy to run gateway integration tests")
    key = secrets.token_urlsafe(32)
    environment = {**os.environ, "WORKBUDDY_GATEWAY_ADDRESS": "https://gateway.example.com",
                   "WORKBUDDY_BACKEND_ADDR": backend, "WORKBUDDY_GATEWAY_KEY": key}
    config = Path(__file__).resolve().parents[1] / "deploy" / "Caddyfile"
    adapted = subprocess.run([executable, "adapt", "--config", str(config), "--adapter", "caddyfile"],
                             env=environment, capture_output=True, text=True, check=True)
    assert key not in adapted.stdout + adapted.stderr
