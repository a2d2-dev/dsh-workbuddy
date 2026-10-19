# Deployment Guide

Deploy the plugin, its Python service and an authenticated HTTPS gateway. The Python listener stays on loopback. Every Python service owns one WorkBuddy account shared by its DSH instance; deploy separate instances for separate accounts or trust boundaries.

Review the [third-party permission requirements](../README.md#before-you-connect) before connecting an account. Successful browser authorization does not establish upstream approval for this integration.

## Prerequisites

- Node.js `^22.19.0 || >=24.0.0`, pnpm, and DSH packages `0.2.0-rc.2`.
- Python 3.10+, uv, Caddy and a persistent service manager such as Supervisor.
- A domain with DNS pointing to the gateway and network access for Caddy certificate issuance, DSH-to-gateway requests and upstream account/model requests.
- A WorkBuddy account that can access the requested models.

## First-Time Setup

### 1. Build the DSH plugin

```sh
git clone https://github.com/a2d2-dev/dsh-workbuddy.git
cd dsh-workbuddy
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm check:package
```

Use the package manager selected in `package.json` (pnpm `10.4.1`) and the committed lockfile. `check:package` builds and verifies the archive, including documentation assets. Back up your existing profile and service configuration before changing them.

### 2. Prepare the pinned Python implementation

The following paths are examples; adapt the paths, service account and executable locations to your host. The clone command assumes the destination is provisioned and writable by the appropriate deployment account.

```sh
git clone https://github.com/Zhengyuuuui/workbuddy2api.git /opt/workbuddy2api
git -C /opt/workbuddy2api checkout --detach 1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc
cd /opt/dsh-workbuddy
uv sync --frozen --no-dev
```

The plugin's `pyproject.toml` and `uv.lock` own the service dependencies. The upstream checkout provides protocol source; its own virtual environment is not used. Set `WORKBUDDY_PROXY_SOURCE` to that checkout. Configure `WORKBUDDY_ENDPOINT`, `WORKBUDDY_SESSION_FILE`, `WORKBUDDY_LOGIN_TTL_SECONDS` and `WORKBUDDY_LOG_FILE` as documented in the main README.

### 3. Supervise the loopback service

Provision private writable session/log directories through your deployment system and run the service under its intended account. Use [workbuddy2api.conf](workbuddy2api.conf) as a Supervisor example. Keep the listener at `127.0.0.1:18788` (or another loopback address/port selected for your deployment) with one worker per account.

### 4. Provision and verify the authenticated gateway

Deploy the supplied [Caddyfile](Caddyfile) and provision these variables through the gateway's service environment. [gateway.env.example](gateway.env.example) shows the format; its blank key deliberately denies all access.

| Variable | Purpose |
| --- | --- |
| `WORKBUDDY_GATEWAY_ADDRESS` | Your public HTTPS origin, for example `https://workbuddy-gateway.example.com` |
| `WORKBUDDY_GATEWAY_BIND` | Listening interface; the example uses `0.0.0.0` |
| `WORKBUDDY_BACKEND_ADDR` | Local Python address, for example `127.0.0.1:18788` |
| `WORKBUDDY_GATEWAY_KEY` | High-entropy bearer secret supplied by your secret store |

Store the same gateway key, without an assignment prefix, in the file selected by DSH's `gatewayKeyFile`. Keep that file and the gateway environment private. Do not reuse an upstream account token as the gateway key. DSH requires HTTPS outside loopback.

The Supervisor example expects the Caddyfile at `/etc/workbuddy2api/Caddyfile` and a shell-compatible environment file at `/etc/workbuddy2api/gateway.env`. Provision them using the deployment system. Only source environment files you control. With those variables exported, validate the configuration before starting the gateway:

```sh
caddy validate --config /etc/workbuddy2api/Caddyfile --adapter caddyfile
```

The configuration authenticates all paths, returns 401 for missing/incorrect credentials, denies requests when the configured key is empty or missing, and strips Authorization before forwarding to Python. Secrets remain runtime environment placeholders in Caddy's adapted configuration. The admin API is disabled; apply configuration changes by restarting the supervised process. Do not add unauthenticated health or fallback routes.

Before authorizing a WorkBuddy account, verify rejection without valid credentials. Replace the example origin:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://workbuddy-gateway.example.com/workbuddy/status
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H 'Authorization: Bearer deliberately-invalid-test-key' \
  https://workbuddy-gateway.example.com/workbuddy/status
```

The supplied Caddy configuration returns `401` for both checks. Repeat rejection tests for every exposed account and inference route using its correct HTTP method, verify credential stripping, and confirm the Python port cannot be reached externally. Do not continue if those boundaries are missing.

### 5. Register the plugin and connect in DSH

Run this against your existing DSH installation and intended profile:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-workbuddy
```

Set the profile's `cordis.patch.yml` entry using the [configuration example](../README.md#install). `gatewayBaseURL` must be an origin, without a `/v1` path, query or fragment. `gatewayKeyFile` must be an absolute path on the **DSH host**; its contents are only the gateway bearer credential, not a WorkBuddy token or an environment-variable assignment. Protect that file with owner-only access.

Restart the DSH host through its existing service manager as needed, then reload browser tabs. In Settings → WorkBuddy, choose **Connect WorkBuddy** and **Open sign-in page**, complete authorization, and return to the original page. The page polls for completion. If authorization expires, start a new login there. Confirm account status, catalog and credits before choosing a model.

### 6. Verify a small end-to-end request

In a new DSH test conversation, choose an available WorkBuddy model by its exact ID. Check its current billing and promotion details, send a short prompt, and verify streaming plus a read-only tool-call/result round trip. These requests may consume credits.

Operators can additionally run the gateway probe from the plugin checkout:

```sh
/absolute/path/to/dsh-workbuddy/.venv/bin/python deploy/verify_gateway.py \
  --base-url https://workbuddy-gateway.example.com \
  --key-file /absolute/path/to/workbuddy-gateway-key \
  --model YOUR_AVAILABLE_MODEL_ID
```

Use an authorized test account and replace all placeholders. The key file must exist on the machine running the probe. The probe sends inference requests and prints account identity, so sanitize output before sharing. It checks one missing-key route and a tool round trip; it does not replace the full gateway rejection checks or acceptance inside DSH. See [verification steps](#verification-and-updates) and the [operator checklist](../docs/OPERATIONS.md#acceptance).

## Verification and Updates

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm check:package
uv sync --frozen
PYTHONPATH=/opt/workbuddy2api/server uv run --frozen pytest
```

The gateway integration tests start the shipped Caddy configuration and a local test backend, requiring no live account. They verify rejection, credential stripping and missing-secret behavior. Install Caddy before running the full suite; CI includes it.

Back up the working plugin commit and relevant profile/service configuration before an update. Restart Python for service changes and restart the DSH host for host-plugin changes; reload existing browser tabs. Use the package manager and the profile's physical home and pnpm store for profile operations. Do not manually repair generated links or lockfiles.

Complete live streaming and tool-call acceptance and follow the recovery steps in [Service Operations](../docs/OPERATIONS.md). Remove only this plugin's profile entry/bundle when uninstalling. Sign out first if credentials should be deleted; uninstall alone retains the session file.
