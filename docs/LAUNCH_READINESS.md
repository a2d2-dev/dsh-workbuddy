# Launch Readiness

Reviewed locally on 2026-10-19 against source commit `06955ff`, package version `0.1.0`. Suitable for a source-based, self-hosted alpha for existing DSH users. Broader international promotion, registry distribution and a managed multi-user service need the work below. The [detailed Chinese review](OPEN_SOURCE_REVIEW.zh-CN.md) records the supporting findings.

## Deployment Gates

- [ ] Deliver a reproducible gateway configuration with HTTPS between hosts, authentication on every forwarded route, and removal of the gateway bearer key before forwarding. The Python application itself accepts requests without this key and must stay on loopback. See `server/workbuddy_service.py` and `deploy/README.md`.
- [ ] Keep the operating model explicit: one account per Python service, shared by the authenticated DSH instance. Separate deployments are required for separate trust boundaries. A hosted multi-user product requires an additional isolation and authorization design.
- [ ] Complete live acceptance in the target deployment: browser authorization, catalog/credits, English desktop/narrow-screen UI, streamed text, a tool-result round trip, failed authorization, service restart and rollback.

## International Release Work

| Priority | Finding | Acceptance |
| --- | --- | --- |
| High | The provider free label in `src/models.ts` is Chinese; `server/session.py` prefers Chinese descriptions; `server/pricing.py` reads Chinese promotion copy | Language handling covers upstream metadata, API data and UI; verify an English DSH session and retain Chinese support |
| High | `src/models.ts` sets numeric cost metadata to zero for every model | Verify the host's presentation and represent unknown cost using supported host behavior; do not imply all inference is free |
| High | `pnpm pack` includes local Python bytecode but omits README screenshots and the deployment guide | Fix package selection at the source, regenerate and inspect the archive; no caches, secrets or private paths, and complete accessible documentation |
| High | Installation spans DSH, Python, pinned upstream source and an external gateway; upstream does not commit `uv.lock` | Test a clean English installation path and record resolved Python dependencies and an actual compatibility matrix |
| High | No repository CI workflows or Actions runs were present at review | Add reproducible TypeScript/Python checks, build and package-content validation before releases |
| High | Operator ownership and data handling are not yet accepted by a named operator | Complete the private ownership records, security channel, alert destinations, retention and recovery exercise in the runbook |
| Normal | No issue/PR templates, code of conduct, changelog or published GitHub release; package discovery metadata is incomplete | Establish contribution/release conventions and repository/support metadata before the first stable release |
| Normal | Screenshots are Chinese and include other host plugins | Capture a sanitized English walkthrough focused on this independent plugin |

Repository security settings queried during review showed Secret Scanning, Push Protection, Dependabot Security Updates and private vulnerability reporting disabled. Administrators should establish a private reporting channel and review these settings. This documentation update does not change access or repository settings.

## Evidence and Limits

- TypeScript tests: 20 passed; typecheck and build passed on Node.js `22.20.0`, pnpm `10.4.1`, and installed DSH packages `0.2.0-rc.2`.
- Python tests: 15 passed against upstream `1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc`, using Python `3.14.2`, pytest `9.1.1`, FastAPI `0.148.0`, Pydantic `2.14.1` and httpx `0.28.1` in a separate temporary checkout.
- Fresh, disconnected application startup and in-process requests to `/workbuddy/status`, `/workbuddy/models` and `/health` passed. This also confirms the external gateway authentication dependency.
- A local archive was generated and inspected, revealing the packaging issues above. Archive generation alone is not release acceptance.
- A limited pattern scan of the two reachable commits and 37 unique Git objects found no matching private keys, common tokens or private-location patterns. This is not a comprehensive secret audit.
- No live account, running DSH browser, production gateway or target-region network was exercised in this review. Prior deployment notes are historical evidence, not a new live acceptance result.
- Source review confirms server-side tokens and default summary logging. Operators still need to define credential protection, protocol JSONL rotation, backup retention and data deletion. See [SECURITY.md](../SECURITY.md).

## Initial Positioning and Handover

Lead with account integration, live credit/model visibility and streaming tool workflows for people already using DSH and WorkBuddy. Local source review does not establish market demand or geographic eligibility. Confirm those with target users and the upstream service before making public claims.

Use the [operator runbook](OPERATIONS.md) for the planned DOT handover. Named ownership, escalation and release acceptance remain to be completed. Public communications should avoid unverified claims about permanent free access, availability in every region, official endorsement or guaranteed support hours.
