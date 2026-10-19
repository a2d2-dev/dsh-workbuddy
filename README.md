# DSH WorkBuddy

[English](README.md) | [简体中文](README.zh-CN.md)

Independent WorkBuddy account plugin for DeepSeek Harness. Adds Settings → WorkBuddy for browser sign-in, account status, credit balances and package expiry, and a searchable model catalog with free-model filtering, credit multipliers, promotions, and capabilities. The model selector exposes the account's chat models under the WorkBuddy provider, distinguishes duplicate names by ID, and labels explicitly free models. This package is independent of the A2D2 orchestration and DimAgent plugins.

The host plugin delegates model requests to DSH's existing `PiAiAdapter`. The separately supervised Python service imports the maintained [workbuddy2api](https://github.com/Zhengyuuuui/workbuddy2api) implementation for streaming and tool-call protocol conversion. Tokens stay on the service host; the browser receives only an authorization link and account status. No WorkBuddy desktop process is required after browser authorization.

## Project Status

Early-stage, self-hosted integration for existing DSH users. Each Python service owns one WorkBuddy account; authenticated users of the same DSH instance share that account and its credits. Use separate deployments for separate trust boundaries. This project does not provide a hosted service or tenant isolation.

The settings interface supports English and Simplified Chinese, including model descriptions and promotion text when supplied by upstream. Provider model names use an English free label.

Model availability, credit multipliers and time-limited free promotions follow your upstream account. Check the live credit information in Settings. This is an independent community integration, with no affiliation or endorsement claimed from WorkBuddy or DeepSeek.

Start with a source checkout and the [deployment guide](deploy/README.md), which includes an authenticated Caddy gateway configuration.

## Community and Operations

- [Contributing and local verification](CONTRIBUTING.md)
- [Security, credentials, and data handling](SECURITY.md)
- [Support and bug reports](SUPPORT.md)
- [Service operation and recovery](docs/OPERATIONS.md)

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

Requires Node.js `^22.19.0 || >=24.0.0`, pnpm, and DSH packages `0.2.0-rc.2`. Build with `pnpm install --frozen-lockfile && pnpm build`, then install the bundle using `dsh plugin --profile web add /absolute/path/to/dsh-workbuddy`. Configure the entry in the profile's `cordis.patch.yml`:

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

Requires Python 3.10+ and uv. Check out [workbuddy2api](https://github.com/Zhengyuuuui/workbuddy2api) at revision `1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc`. In this plugin directory, install the locked service dependencies with `uv sync --frozen --no-dev`, then run `.venv/bin/uvicorn --app-dir server workbuddy_service:create_app --factory --host 127.0.0.1 --port 18788`. Set the following environment variables through the service supervisor:

| Variable | Purpose |
| --- | --- |
| `WORKBUDDY_PROXY_SOURCE` | Checkout of the pinned upstream repository |
| `WORKBUDDY_ENDPOINT` | WorkBuddy backend origin, normally `https://www.workbuddy.ai` |
| `WORKBUDDY_SESSION_FILE` | Private, writable credential file; existing proxy sessions are accepted |
| `WORKBUDDY_LOGIN_TTL_SECONDS` | Authorization expiry in seconds, normally `300` |
| `WORKBUDDY_LOG_FILE` | Protocol summary log path |

Use Supervisor or another persistent service manager, with a single service worker to own the account and its pending login. Refresh is serialized, and credential updates use atomic file replacement. Sign-out removes this service's authorization without revoking other devices. An expired login can be restarted from Settings. The gateway access key is deployment authentication, distinct from WorkBuddy account authorization.

## Verify

Run `pnpm test`, `pnpm typecheck`, and `pnpm check:package` (builds and verifies the distributable). For service tests run `uv sync --frozen`, then `PYTHONPATH=/absolute/path/to/workbuddy2api/server uv run --frozen pytest`. Install Caddy to include the real gateway integration tests. CI covers Node.js 22/24 and Python 3.10/3.14. Live acceptance additionally requires DSH settings rendering, an authorized account, streamed text, and a tool-call round trip.

## Remove

Remove this bundle through the DSH plugin manager and stop its dedicated services. Existing DSH providers and sessions are unaffected. WorkBuddy credentials are retained on disk unless signed out before removal.

## License

Apache-2.0. See [LICENSE](LICENSE). The separately installed upstream project retains its own license.
