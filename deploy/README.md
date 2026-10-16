# Deployment Guide

Install the plugin in your DSH `web` profile, then open Settings → WorkBuddy to authorize your account. No desktop application needs to remain running after authorization. All paths below are example deployment locations; adapt them to your host.

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

Validated with 20 TypeScript tests, 15 Python tests, a successful build, and browser checks at desktop and mobile sizes. The settings page exposes real credit packages and a searchable catalog; browser acceptance verifies that searching DeepSeek returns distinct regular/SG routes and the free-only filter excludes SG. Free labels come from explicit upstream prices and active scheduled promotions; unknown prices stay unknown. `verify_gateway.py` verifies missing-key rejection, account discovery, streaming tool-call arguments, and a second request containing the tool result.

For end-to-end acceptance, select an available WorkBuddy model in a test DSH conversation, request a read-only tool call, and verify both tool execution and the final model response. Model counts, balances, and active promotions depend on the connected account.

Back up your profile overlay and existing service configuration before installation. Remove only this plugin's profile entry/bundle when uninstalling; preserve subsequent unrelated profile edits.
