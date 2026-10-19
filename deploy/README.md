# Deployment Guide

This guide is for an existing DSH `web` installation and a self-hosted, single-account deployment. Complete service and gateway setup before authorizing WorkBuddy in DSH. No desktop application needs to remain running after authorization. All paths below are example deployment locations; adapt them to your host.

Start with the [prerequisites](../README.md#prerequisites) and [third-party permission requirements](../README.md#before-you-connect). A successful login or a working deployment is not evidence that upstream permits this integration. The gateway configuration is operator-provided; this repository does not yet ship a complete authenticated gateway configuration.

## First-Time Setup

### 1. Build the DSH plugin

```sh
git clone https://github.com/a2d2-dev/dsh-workbuddy.git
cd dsh-workbuddy
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

Use Node.js `^22.19.0 || >=24.0.0` and the committed lockfile. Prior review used pnpm `10.4.1` with DSH packages `0.2.0-rc.2`; record your versions. Back up the existing profile overlay and service configuration before changing them.

### 2. Prepare the pinned Python implementation

From the parent directory of the plugin checkout, create a separate upstream checkout:

```sh
git clone https://github.com/Zhengyuuuui/workbuddy2api.git
git -C workbuddy2api checkout 1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc
(cd workbuddy2api && uv sync)
```

The pinned project requires Python `>=3.10`. It does not commit `uv.lock`, so the source pin does not freeze resolved Python dependencies. Record those versions during acceptance. Use this checkout's virtual environment to run **this plugin's** service entry point, not the upstream standalone entry point.

### 3. Configure and supervise the loopback service

Adapt [workbuddy2api.conf](workbuddy2api.conf) to your host. Provision private, writable state and log directories owned by the service account. Configure the five variables in the [service reference](../README.md#service), including `WORKBUDDY_PROXY_SOURCE`, `WORKBUDDY_SESSION_FILE` and `WORKBUDDY_LOG_FILE`. Keep tokens and gateway credentials outside source control.

The service command is:

```sh
/absolute/path/to/workbuddy2api/.venv/bin/uvicorn \
  --app-dir /absolute/path/to/dsh-workbuddy/server \
  workbuddy_service:create_app --factory \
  --host 127.0.0.1 --port 18788
```

Run a single worker under Supervisor or your existing persistent service manager. The Python application has no inbound bearer authentication and must remain on loopback. Keep the gateway on that host; DSH may connect to the gateway over HTTPS. Do not bind Python to a public interface to make it reachable.

### 4. Provision and verify the authenticated gateway

Configure the gateway to validate its own bearer credential on **every forwarded route**, remove that credential before forwarding, and proxy only to `127.0.0.1:18788`. Require HTTPS between hosts. The Supervisor example references operator-supplied gateway/Caddy configuration; it does not create it.

Before authorizing a WorkBuddy account, verify rejection without valid credentials. Replace the example origin:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://workbuddy-gateway.example.com/workbuddy/status
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H 'Authorization: Bearer deliberately-invalid-test-key' \
  https://workbuddy-gateway.example.com/workbuddy/status
```

Both checks must return `401` for the supplied gateway probe to pass. Repeat rejection tests for every exposed account and inference route using its correct HTTP method, verify credential stripping in gateway configuration, and confirm the Python port cannot be reached externally. Do not continue if those boundaries are missing.

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
/absolute/path/to/workbuddy2api/.venv/bin/python deploy/verify_gateway.py \
  --base-url https://workbuddy-gateway.example.com \
  --key-file /absolute/path/to/workbuddy-gateway-key \
  --model YOUR_AVAILABLE_MODEL_ID
```

Use an authorized test account and replace all placeholders. The key file must exist on the machine running the probe. The probe sends inference requests and prints account identity, so sanitize output before sharing. It checks one missing-key route and a tool round trip; it does not replace the full gateway rejection checks or acceptance inside DSH. See [Acceptance](#acceptance) and the [operator checklist](../docs/OPERATIONS.md#release-acceptance).

## Runtime

| Component | Location |
| --- | --- |
| Plugin checkout | `/opt/dsh-workbuddy` |
| DSH runtime | Your DSH installation directory |
| Physical profile home | The physical directory selected by `DSH_HOME` |
| Supervisor programs | `workbuddy2api`, `workbuddy2api-gateway` |
| Backend listener | `127.0.0.1:18788` |
| Authenticated gateway | `https://workbuddy-gateway.example.com` |
| WorkBuddy credentials | `/var/lib/workbuddy2api/session.json` |
| Gateway key for DSH | `/etc/workbuddy2api/gateway-key` |
| Gateway environment and Caddy | `/etc/workbuddy2api/` |
| Protocol implementation | `/opt/workbuddy2api` |

`workbuddy2api.conf` is an example Supervisor configuration. Provision its directories with ownership appropriate for your service account before starting it. Configure Caddy with an authenticated listener reachable by DSH, forwarding only to the loopback Python backend. The gateway must validate its separate bearer key and strip it before forwarding. Endpoint addresses and paths are deployment settings, not plugin defaults. Credential contents must never be copied into this repository.

## Updates

Build the plugin with Node 22 and `pnpm install --frozen-lockfile && pnpm test && pnpm build`. Run `supervisorctl restart workbuddy2api` for Python service changes, and restart `dsh-web-server` for host plugin changes. Browser assets are served through DSH's plugin loader.

For profile package operations, use the pnpm version selected by that profile, set `DSH_HOME` to its physical home directory, and use the same pnpm store as the existing installation. A home-directory symlink can produce invalid relative package links when pnpm installs from the physical directory. Re-resolve affected local dependencies through the manager's `update` command; do not manually repair generated links or lockfiles. Reload existing browser tabs after deployment and verify that they display the updated settings.

## Acceptance

The prior deployment record reports 20 TypeScript tests, 15 Python tests, a successful build, and browser checks at desktop and mobile sizes. Treat these as historical evidence; repeat acceptance for your own deployment. The settings page exposes real credit packages and a searchable catalog; browser acceptance verifies that searching DeepSeek returns distinct regular/SG routes and the free-only filter excludes SG. Free labels come from explicit upstream prices and active scheduled promotions; unknown prices stay unknown. `verify_gateway.py` verifies missing-key rejection, account discovery, streaming tool-call arguments, and a second request containing the tool result.

For end-to-end acceptance, select an available WorkBuddy model in a test DSH conversation, request a read-only tool call, and verify both tool execution and the final model response. Model counts, balances, and active promotions depend on the connected account.

Back up your profile overlay and existing service configuration before installation. Remove only this plugin's profile entry/bundle when uninstalling; preserve subsequent unrelated profile edits.
