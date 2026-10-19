# DSH WorkBuddy

[English](README.md) | [简体中文](README.zh-CN.md)

Independent WorkBuddy account plugin for DeepSeek Harness. Adds Settings → WorkBuddy for browser sign-in, account status, credit balances and package expiry, and a searchable model catalog with free-model filtering, credit multipliers, promotions, and capabilities. The model selector exposes the account's chat models under the WorkBuddy provider, distinguishes duplicate names by ID, and labels explicitly free models. This package is independent of the A2D2 orchestration and DimAgent plugins.

The host plugin delegates model requests to DSH's existing `PiAiAdapter`. The separately supervised Python service imports the maintained [workbuddy2api](https://github.com/Zhengyuuuui/workbuddy2api) implementation for streaming and tool-call protocol conversion. Tokens stay on the service host; the browser receives only an authorization link and account status. No WorkBuddy desktop process is required after browser authorization.

## Project Status

Early-stage, self-hosted integration for existing DSH users. Each Python service owns one WorkBuddy account; authenticated users of the same DSH instance share that account and its credits. Use separate deployments for separate trust boundaries. This project does not provide a hosted service or tenant isolation.

The settings interface has English and Chinese dictionaries, but model descriptions, promotion text, and the model selector's free label still have Chinese-only behavior. Current screenshots show Chinese. A full English walkthrough remains a release task.

Model availability and credits follow your upstream account. The provider's numeric cost metadata is currently zero for all models; this is not a statement that all models are free. Use the explicit free labels and live credit information in Settings. This is an independent community integration, with no affiliation or endorsement claimed from WorkBuddy or DeepSeek.

Start with a source checkout and the [deployment guide](deploy/README.md). A package archive has been tested locally, but its contents still need cleanup before registry distribution. See the [launch readiness checklist](docs/LAUNCH_READINESS.md) for the remaining work.

## Community and Operations

- [Contributing and local verification](CONTRIBUTING.md)
- [Security, credentials, and data handling](SECURITY.md)
- [Support and bug reports](SUPPORT.md)
- [Operator handover and release acceptance](docs/OPERATIONS.md)

## Screenshots

Captured from the plugin's Chinese interface. Account identity, balances, and package expiry dates are redacted. Model availability, multipliers, and promotions reflect the capture date and may change.

### Account and Credits

![WorkBuddy settings with account status and redacted credit packages](docs/screenshots/settings-overview.png)

### Model Search

Duplicate display names retain their distinct model IDs and billing information.

![DeepSeek search results showing distinct model IDs and billing](docs/screenshots/deepseek-models.png)

### Free Models

Free labels come from explicit upstream billing data and active promotions.

![Free-only filter showing three models](docs/screenshots/free-models.png)

## Install

Requires Node.js `^22.19.0 || >=24.0.0` and a compatible DSH installation. The local review used DSH packages `0.2.0-rc.2`; the wider peer-dependency range is not a tested compatibility matrix. Build with `pnpm install --frozen-lockfile && pnpm build`, then install the bundle using `dsh plugin --profile web add /absolute/path/to/dsh-workbuddy`. Configure the entry in the profile's `cordis.patch.yml`:

```yaml
- id: workbuddy
  config:
    gatewayBaseURL: https://workbuddy-gateway.example.com
    gatewayKeyFile: /absolute/path/to/workbuddy-gateway-key
    requestTimeoutMs: 30000
    catalogTtlMs: 60000
    streamIdleTimeoutMs: 300000
```

The key file contains the gateway's bearer credential, with no environment-variable assignment. Do not place upstream tokens in DSH configuration or source control. The gateway endpoint must be protected by authentication; the Python listener should remain on loopback behind that gateway.

## Service

Validated upstream revision: `1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc`. Install its dependencies with `uv sync` and run its virtual environment's `uvicorn --app-dir /absolute/path/to/dsh-workbuddy/server workbuddy_service:create_app --factory --host 127.0.0.1 --port 18788`. Set the following environment variables through the service supervisor:

| Variable | Purpose |
| --- | --- |
| `WORKBUDDY_PROXY_SOURCE` | Checkout of the pinned upstream repository |
| `WORKBUDDY_ENDPOINT` | WorkBuddy backend origin, normally `https://www.workbuddy.ai` |
| `WORKBUDDY_SESSION_FILE` | Private, writable credential file; existing proxy sessions are accepted |
| `WORKBUDDY_LOGIN_TTL_SECONDS` | Authorization expiry in seconds, normally `300` |
| `WORKBUDDY_LOG_FILE` | Protocol summary log path |

Use Supervisor or another persistent service manager, with a single service worker to own the account and its pending login. Refresh is serialized, and credential updates use atomic file replacement. Sign-out removes this service's authorization without revoking other devices. An expired login can be restarted from Settings. The gateway access key is deployment authentication, distinct from WorkBuddy account authorization.

## Verify

Run `pnpm test`, `pnpm typecheck`, and `pnpm build`. For service tests use the upstream virtual environment with `PYTHONPATH=/path/to/upstream/server:/path/to/dsh-workbuddy/server pytest server/test_session.py server/test_pricing.py`. Real acceptance additionally requires DSH settings rendering, an authorized account, streamed text, and a tool-call round trip. Upstream currently has one stale client-header assertion; this package does not alter or suppress it.

## Remove

Remove this bundle through the DSH plugin manager and stop its dedicated services. Existing DSH providers and sessions are unaffected. WorkBuddy credentials are retained on disk unless signed out before removal.

## License

Apache-2.0. See [LICENSE](LICENSE). The separately installed upstream project retains its own license.
