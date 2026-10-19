# Support

Report reproducible plugin problems through [GitHub Issues](https://github.com/a2d2-dev/dsh-workbuddy/issues). Support is community-based; there is no response-time commitment. Use [SECURITY.md](SECURITY.md) for vulnerabilities.

## Bug Reports

Include:

- Plugin version or commit, DSH version, operating system, browser and interface language.
- Node.js, pnpm, Python and pinned workbuddy2api versions.
- Installation method and whether the problem affects sign-in, credits, catalog, streaming, or tool calls.
- Steps to reproduce, expected behavior, actual behavior, and approximate failure time with timezone.
- HTTP status and sanitized response shape, or a short sanitized log excerpt. For data problems, trace the upstream response through the plugin API to the displayed result.
- Whether the same operation succeeds after reconnecting or in a separate test conversation.

Never attach a full session file, `.env`, gateway credential, authorization URL, unredacted HAR/network export, conversation history, or account screenshot. Remove Authorization and Cookie headers, identifiers, personal paths, prompt content, and tool results from diagnostic material.

## Common Checks

| Symptom | Check |
| --- | --- |
| Cannot reach the gateway | Service and gateway status, DNS/TLS, configured origin, and gateway key file |
| Sign-in expired | Start a new login from Settings; authorization expires and cannot be replayed |
| Sign-in already pending | Complete or let the existing shared-service login expire |
| Connected, credits unavailable | Credits may fail independently of catalog discovery; do not treat unavailable as zero |
| No models | Account status, catalog response, and whether upstream offers tool-capable models to that account |
| A model appears free or costs zero | Only explicit free billing/promotion metadata establishes free status; provider cost metadata is currently zero for every model |
| Updated UI is missing | Rebuild, restart the DSH host as appropriate, then reload existing browser tabs |

Operators should also follow the [handover and incident guide](docs/OPERATIONS.md). Upstream account eligibility, billing disputes, and subscription management belong with the upstream account provider.
