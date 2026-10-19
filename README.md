# DSH WorkBuddy

[English](README.md) | [简体中文](README.zh-CN.md)

**Connect your WorkBuddy account to DeepSeek Harness. See your credits, compare available models, and use them in your DSH conversations.**

An independent community plugin for the DSH web profile. **Self-hosted alpha**, for people who already run DSH and can operate a separate Python service and authenticated gateway. No hosted service or official WorkBuddy/DeepSeek endorsement is claimed.

[Start here](#quickstart) · [Deployment guide](deploy/README.md) · [Security and data handling](SECURITY.md) · [Report a problem](SUPPORT.md)

## What You Get

- **Account and credit visibility in DSH:** browser sign-in, connection status, remaining credits, and package expiry dates in Settings → WorkBuddy.
- **A clearer model choice:** search by name or ID, distinguish same-name routes, compare credit multipliers and capabilities, and filter models explicitly marked free by upstream billing or active promotions. The catalog includes account models that support tool calls.
- **Your existing DSH workflow:** select the WorkBuddy provider for streamed responses and tool-call workflows. No WorkBuddy desktop process needs to remain running after browser authorization.

This plugin is independent of the A2D2 orchestration and DimAgent plugins. The [screenshots](#screenshots) show the current interface; the [launch checklist](docs/LAUNCH_READINESS.md) tracks remaining release work.

## Before You Connect

- **Confirm permission for this integration.** WorkBuddy's [Acceptable Use Policy](https://www.workbuddy.ai/document/acceptable-use-policy), sections 3.5 and 4, restricts automated access and requires prior written permission for interoperating plugins and external components. Review the applicable [Service Agreement](https://www.workbuddy.ai/document/term) and confirm permission before use. A successful browser login does not establish approval for a third-party client.
- **One service, one shared account.** Each Python service owns one WorkBuddy account. Authenticated users of the same DSH instance share its credits and account controls. There is no tenant isolation; use separate deployments for separate trust boundaries, subject to upstream account rules.
- **Free labels are conditional.** Models, promotions, expiry and usage limits depend on your account and upstream rules. The plugin grants no extra credits or unlimited access. All provider numeric cost fields currently contain zero; those fields are not evidence of free inference. See [pricing and limits](#pricing-and-limits).

## Quickstart

### Prerequisites

| You need | What to check |
| --- | --- |
| An existing DSH web installation | Local review used DSH packages `0.2.0-rc.2`; the broader peer range is not a tested compatibility matrix |
| Node.js and pnpm | Node.js `^22.19.0 || >=24.0.0`; use the committed lockfile (prior review used pnpm `10.4.1`) |
| A Python service host | Python `>=3.10`, `uv`, the pinned `workbuddy2api` checkout, and a persistent service manager |
| An authenticated gateway | Authenticate every forwarded route, strip the gateway bearer key, and use HTTPS between hosts; keep Python on loopback |
| An eligible WorkBuddy account | Confirm that the intended third-party access is permitted and that the account offers a suitable model |

This is a source-based setup with multiple components. The repository includes a Supervisor example, but **does not yet include a complete authenticated gateway configuration**. Provision and verify that gateway before connecting an account.

### From Source to Your First Conversation

1. **Build the plugin** with the commands in [Install](#install).
2. **Prepare the backend** at the pinned upstream revision and configure its private credential/log paths. Follow [Service](#service) and the ordered [deployment guide](deploy/README.md#first-time-setup).
3. **Secure and connect the gateway.** Verify that missing and incorrect credentials are rejected before installing the plugin into your DSH profile. Set `gatewayBaseURL` and `gatewayKeyFile` as shown below.
4. **Authorize in DSH.** Open Settings → WorkBuddy, choose **Connect WorkBuddy**, then **Open sign-in page**. Complete browser authorization and return to the original settings page. Confirm **Connected**, the catalog, and your credit details; use **Refresh** to reload them.
5. **Try a small conversation.** Select an available model under the **WorkBuddy** provider. For DeepSeek, search the catalog for `DeepSeek` and check the exact model ID, billing and promotion expiry first. Send a short prompt, then verify a read-only tool-call round trip. Inference can consume credits.

Success means the settings page shows your account, the selected model streams a reply, and a tool result returns to the same conversation. A connected status alone does not verify inference. If a step fails, use the [common checks](SUPPORT.md#common-checks); do not remove gateway authentication to troubleshoot.

## How It Works

```text
DSH web UI → DSH host plugin → authenticated gateway → loopback Python service → WorkBuddy
```

The host plugin reuses DSH's `PiAiAdapter`. The separately supervised Python service imports the pinned [workbuddy2api](https://github.com/Zhengyuuuui/workbuddy2api) implementation for streaming and tool-call protocol conversion. WorkBuddy tokens stay on the service host; the browser receives an authorization link and account information. Prompts, conversation history and tool data are sent upstream for inference. See [SECURITY.md](SECURITY.md) for the full data flow and retention boundaries.

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

## Pricing and Limits

**Does this provide free DeepSeek access?** Only upstream can determine your account's eligibility, billing and permitted access. Some model IDs may have temporary promotions; check the account's current model ID, credit multiplier, expiry and usage limits. A screenshot, an October promotion elsewhere, or a zero cost estimate in DSH is not a promise that a request through this integration is free.

**What does “Free only” mean?** It filters explicit zero-credit billing or currently active upstream promotion metadata. Unknown pricing stays unknown. This filter does not verify your remaining promotional allowance or override daily limits, rate limits or upstream terms. Check your WorkBuddy account for authoritative billing and entitlements; unavailable credit data does not mean a zero balance.

## Install

Check the [prerequisites](#prerequisites) first. Clone and build the source:

```sh
git clone https://github.com/a2d2-dev/dsh-workbuddy.git
cd dsh-workbuddy
pnpm install --frozen-lockfile
pnpm build
```

After the service and authenticated gateway are ready, install the bundle into your existing DSH web profile:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-workbuddy
```

Configure the entry in the profile's `cordis.patch.yml`:

```yaml
- id: workbuddy
  config:
    gatewayBaseURL: https://workbuddy-gateway.example.com
    gatewayKeyFile: /absolute/path/to/workbuddy-gateway-key
    requestTimeoutMs: 30000
    catalogTtlMs: 60000
    streamIdleTimeoutMs: 300000
```

Replace the example domain and absolute paths with your deployment values. The key file contains the gateway's bearer credential, with no environment-variable assignment. Do not place upstream tokens in DSH configuration or source control. The gateway endpoint must be protected by authentication; the Python listener should remain on loopback behind that gateway.

## Service

Validated upstream revision: `1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc`. Install its dependencies with `uv sync` and run its virtual environment's `uvicorn --app-dir /absolute/path/to/dsh-workbuddy/server workbuddy_service:create_app --factory --host 127.0.0.1 --port 18788`. Set the following environment variables through the service supervisor:

| Variable | Purpose |
| --- | --- |
| `WORKBUDDY_PROXY_SOURCE` | Checkout of the pinned upstream repository |
| `WORKBUDDY_ENDPOINT` | WorkBuddy backend origin, normally `https://www.workbuddy.ai` |
| `WORKBUDDY_SESSION_FILE` | Private, writable credential file; existing proxy sessions are accepted |
| `WORKBUDDY_LOGIN_TTL_SECONDS` | Authorization expiry in seconds, normally `300` |
| `WORKBUDDY_LOG_FILE` | Protocol summary log path |

See the [first-time deployment steps](deploy/README.md#first-time-setup) and [Supervisor example](deploy/workbuddy2api.conf). Use Supervisor or another persistent service manager, with a single service worker to own the account and its pending login. Refresh is serialized, and credential updates use atomic file replacement. Sign-out removes this service's authorization without revoking other devices. An expired login can be restarted from Settings. The gateway access key is deployment authentication, distinct from WorkBuddy account authorization.

## Verify

Run `pnpm test`, `pnpm typecheck`, and `pnpm build`. For service tests use the upstream virtual environment with `PYTHONPATH=/path/to/upstream/server:/path/to/dsh-workbuddy/server pytest server/test_session.py server/test_pricing.py`. Real acceptance additionally requires DSH settings rendering, an authorized account, streamed text, and a tool-call round trip. Upstream currently has one stale client-header assertion; this package does not alter or suppress it.

## Current Limitations and Community

- Source installation is the current path. Package archive contents still need cleanup before registry distribution.
- English and Chinese settings dictionaries exist, but model descriptions, promotion copy and the model selector's free label still have Chinese-only behavior. Screenshots show Chinese; a full English walkthrough remains a release task.
- Upstream protocol or account-policy changes can affect compatibility. Complete live acceptance in your own deployment before relying on it.
- [Contributing and local verification](CONTRIBUTING.md) · [Support and bug reports](SUPPORT.md) · [Operator handover](docs/OPERATIONS.md) · [Launch readiness](docs/LAUNCH_READINESS.md)

## Remove

Remove this bundle through the DSH plugin manager and stop its dedicated services. Existing DSH providers and sessions are unaffected. WorkBuddy credentials are retained on disk unless signed out before removal.

## License

Apache-2.0. See [LICENSE](LICENSE). The separately installed upstream project retains its own license.
