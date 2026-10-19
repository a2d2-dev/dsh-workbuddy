# Operator Handover

This runbook prepares a future handover to DOT. It describes responsibilities and evidence to collect; it does not imply that DOT has accepted ownership or received credentials. The current supported operating model is one self-hosted account per Python service.

## Ownership Before Handover

Record the following in the operator's private system, with named owners and backups. No production credentials or private host inventory belong in this repository.

| Responsibility | Required handover record |
| --- | --- |
| Repository and releases | Maintainer, reviewer, GitHub access through normal organization controls, last accepted commit |
| Runtime | DSH/profile owner, service host owner, supervisor, gateway, DNS/TLS owner |
| Secrets and upstream account | Account owner, approved secret store, rotation/revocation procedure; transfer by secret reference |
| User support | Issue triage owner, engineering escalation contact, supported languages and actual support hours |
| Incidents | Incident lead, backup contact, alert destination and recovery authority |
| External communications | Person approving compatibility, pricing, privacy and availability claims |

## Deployment Inventory

Record the plugin commit, DSH/package versions, Node.js/pnpm versions, Python version and resolved Python dependencies, pinned workbuddy2api revision, gateway configuration revision, and physical profile home. The current validated upstream source revision is `1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc`.

Use the [deployment guide](../deploy/README.md) and supervisor example. The repository does not yet provide a complete authenticated gateway configuration. Provision that configuration through the deployment system and verify it before use. Keep a single Python worker per account, and require HTTPS between hosts. Use independent instances for separate accounts or trust boundaries.

Back up the relevant profile overlay, supervisor/gateway configuration and last working source/artifact before updating. Store any credential backup privately and record its retention separately. A backup is not a substitute for a tested recovery procedure.

## Release Acceptance

- [ ] A clean checkout installs using the committed pnpm lockfile; TypeScript tests, typecheck and build pass.
- [ ] Python session/pricing tests pass against the documented upstream revision; resolved Python versions are recorded.
- [ ] The package contents are reviewed. No `__pycache__`, `.pyc`, credentials or private paths are shipped; referenced screenshots and deployment instructions are accessible.
- [ ] English desktop and narrow-screen settings are exercised with a test account, including account state, balances, search, free filtering and recovery messages. Model descriptions, promotions and selector labels are reviewed in English too.
- [ ] Missing and incorrect gateway keys are rejected on every exposed route, and the loopback Python listener cannot be reached externally. Verify the gateway removes its bearer key before forwarding.
- [ ] Sign-in completes; an expired login can restart; another browser cannot finish the owner's pending login; sign-out clears authorization and model discovery.
- [ ] A streamed text response succeeds, followed by a complete tool-call and tool-result round trip in DSH.
- [ ] Request cancellation, upstream timeout/rate limit, unavailable credits, service restart and upstream authorization failure have documented recovery behavior.
- [ ] Logs contain useful failure metadata without credentials or conversation content. Protocol JSONL rotation and disk usage are checked.
- [ ] A rollback to the previously accepted commit/configuration succeeds in a test deployment.
- [ ] The release record includes operator/reviewer, exact versions, date, region, completed checks and remaining limitations.

`deploy/verify_gateway.py` can exercise a live gateway with `--base-url`, `--key-file`, and `--model`. Use an authorized test account and a model available to it. It makes inference requests that may consume credits, and its output includes the account identity; sanitize output before sharing. This gateway probe complements acceptance inside DSH.

## Routine Operation

Check service restarts, gateway errors, authentication failures, request timeouts, upstream 429/5xx responses, disk usage and credit availability. `/health` from the mounted upstream application is a process/auth snapshot, not proof that a model request will complete. Use authenticated status/catalog checks and a controlled inference probe to establish readiness. Monitoring frequency and alert thresholds must be chosen for the actual deployment.

Keep verbose LLM logging disabled. Review retention for the protocol JSONL file, upstream rotating log, supervisor output, gateway access logs and backups. Do not promise customers data retention or deletion behavior until the operator has implemented and verified it across all these locations.

For support, collect only the versions, failure time, HTTP status and sanitized metadata described in [SUPPORT.md](../SUPPORT.md). DOT can triage reports and reproduce documented paths; maintainers should investigate code, protocol and security failures. Agree actual escalation contacts and response targets before announcing support coverage.

## Recovery and Rollback

1. Record the affected release, failure time and safe diagnostics. Check gateway access first, then Python status, upstream authorization/catalog, and finally a controlled model request.
2. Stop the rollout if acceptance fails. Restore the previously accepted source or artifact through the normal deployment system; rebuild source if needed. Never patch generated bundles, package links or lockfiles by hand.
3. Restore only the relevant supervisor/gateway/profile settings from the recorded revision, preserving later unrelated profile changes. Restart the affected services and reload the browser.
4. Repeat gateway rejection checks, account/catalog verification and a streamed tool round trip. Record the recovery result and open a sanitized engineering issue for the root cause.
5. If authorization is compromised, follow [SECURITY.md](../SECURITY.md). Restoring application code does not rotate or revoke credentials. Avoid restoring stale session files automatically; reconnect using the account owner's authorization when necessary.

## Overseas Launch Gate

Before public promotion, close the priorities in the [launch readiness checklist](LAUNCH_READINESS.md). The initial audience is developers already using DSH and WorkBuddy who can operate their own service. A managed multi-user offering requires separate account isolation, user-specific access controls, abuse controls, data handling and billing design, followed by its own acceptance review.

The initial message should describe the actual benefit: connect a WorkBuddy account to DSH, inspect live credits and models, and run streaming/tool workflows. Avoid promises of permanently free models, universal geographic availability, official endorsement, tenant isolation, or a support SLA that has not been established.
