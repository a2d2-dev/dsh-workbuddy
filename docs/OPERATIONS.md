# Service Operations

Each Python service owns one WorkBuddy account shared by its DSH instance. Operate separate deployments for separate accounts or trust boundaries. Follow the [deployment guide](../deploy/README.md) for the locked service environment, gateway and Supervisor configuration.

## Updates

Record the working plugin commit, DSH version, upstream revision and service/gateway configuration before updating. Back up only the relevant profile overlay and deployment configuration; keep credentials and any credential backups in the deployment secret store.

Run the TypeScript tests, typecheck and package verification, then the Python tests against the pinned upstream revision. Deploy through the normal service manager, restart affected services and reload existing DSH tabs. Do not hand-edit generated bundles, package links or lockfiles.

## Acceptance

1. Verify that missing and incorrect gateway keys are rejected, including on health, account and inference routes. Verify that the Python listener is accessible only on loopback.
2. Complete browser authorization, inspect account/model/credit information, search models and check the free-only filter. Test both supported interface languages and a narrow settings pane.
3. Run a streamed text request, then a tool-call and tool-result round trip in a test DSH conversation.
4. Check sign-out, expired authorization, unavailable credits, a service restart and upstream errors. An unavailable credit balance must not be treated as zero.

`deploy/verify_gateway.py --base-url URL --key-file PATH --model ID` exercises a live gateway. Use an authorized test account and an available model; the probe may consume credits. Its output includes the account identity, so sanitize it before sharing. This probe complements acceptance inside DSH.

## Monitoring and Logs

Monitor service restarts, gateway errors, authorization failures, timeouts, upstream rate limits, disk usage and credit availability. `/health` reports a process/auth snapshot; use authenticated status/catalog checks and a controlled inference probe to establish readiness.

Keep verbose LLM logging disabled. Configure retention and rotation for the protocol JSONL file separately from Supervisor output and the upstream rotating log. Review gateway access logs and backups too. Keep Authorization headers, cookies, authorization URLs, prompts and tool results out of routine diagnostics. See [SECURITY.md](../SECURITY.md) for data flow and credential deletion behavior.

## Recovery

1. Record safe diagnostics and the affected release. Check gateway access, then Python status, upstream authorization/catalog and a controlled inference request.
2. Restore the previously accepted source or artifact and rebuild if needed. Restore only relevant deployment/profile configuration, preserving unrelated later edits.
3. Restart the affected services, reload DSH, and repeat gateway rejection, account discovery and streamed tool-call checks.
4. Investigate the root cause using sanitized diagnostics from [SUPPORT.md](../SUPPORT.md). Reconnect through account authorization if needed; do not automatically restore stale session files.

If a credential is compromised, stop access, rotate the gateway key and revoke affected authorization using upstream account controls. Rolling back application code does not revoke credentials.
