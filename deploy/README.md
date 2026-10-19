# Deployment Guide

Deploy the plugin, its Python service and an authenticated HTTPS gateway. The Python listener stays on loopback. Every Python service owns one WorkBuddy account shared by its DSH instance; deploy separate instances for separate accounts or trust boundaries.

## Prerequisites

- Node.js `^22.19.0 || >=24.0.0`, pnpm, and DSH packages `0.2.0-rc.2`.
- Python 3.10+, uv, Caddy and a persistent service manager such as Supervisor.
- A domain with DNS pointing to the gateway and network access for Caddy certificate issuance, DSH-to-gateway requests and upstream account/model requests.
- A WorkBuddy account that can access the requested models.

## Plugin and Service

Build and install the plugin as described in [README.md](../README.md). The following paths are examples; adapt the paths, service account and executable locations to your host.

```sh
git clone https://github.com/Zhengyuuuui/workbuddy2api.git /opt/workbuddy2api
git -C /opt/workbuddy2api checkout --detach 1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc
cd /opt/dsh-workbuddy
uv sync --frozen --no-dev
```

The plugin's `pyproject.toml` and `uv.lock` own the service dependencies. The upstream checkout provides protocol source; its own virtual environment is not used. Set `WORKBUDDY_PROXY_SOURCE` to that checkout. Configure `WORKBUDDY_ENDPOINT`, `WORKBUDDY_SESSION_FILE`, `WORKBUDDY_LOGIN_TTL_SECONDS` and `WORKBUDDY_LOG_FILE` as documented in the main README.

Provision private writable session/log directories through your deployment system and run the service under its intended account. Use [workbuddy2api.conf](workbuddy2api.conf) as a Supervisor example. Keep the listener at `127.0.0.1:18788` (or another loopback address/port selected for your deployment) with one worker per account.

## Authenticated Gateway

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
