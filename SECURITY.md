# Security and Data Handling

## Reporting a Vulnerability

Do not publish credentials, authorization links, session files, personal data, or working exploit details in a public issue. If the repository offers GitHub private vulnerability reporting, use **Security → Report a vulnerability**. Otherwise open an issue requesting a private reporting channel without disclosing the vulnerability details. A dedicated security contact and response target have not yet been established.

Version `0.1.0` is an early-stage release. No long-term security support window or response-time commitment is currently promised. Operators should track upstream changes and review this repository's release notes before updating.

## Deployment Boundary

The Python service does not implement inbound bearer authentication. It must listen on loopback behind an authenticated gateway. The gateway must authenticate every forwarded route, use HTTPS when crossing hosts, and remove the gateway credential before forwarding to Python. Do not expose Python directly to the internet or bind it to a public interface.

DSH account routes rely on the host's authentication guard and a custom request header. A gateway key authorizes access to the shared service; it does not identify separate tenants. All authenticated users of a DSH instance can use its connected WorkBuddy account, and account controls affect that shared account. Deploy separate service instances and credentials for separate trust boundaries.

Gateway URL validation currently accepts HTTP as well as HTTPS. Operators must require HTTPS for remote destinations; successful configuration validation does not establish transport security.

## Data Flow

| Data | Destination and persistence |
| --- | --- |
| Gateway bearer key | Read by the DSH host from a configured file and sent to the gateway; the plugin browser UI does not receive it |
| WorkBuddy access and refresh tokens | Held in Python process memory and persisted in `WORKBUDDY_SESSION_FILE` |
| Account identity and balances | Retrieved from upstream and displayed to authenticated DSH users |
| Authorization link | Returned to the browser that started sign-in; contains sensitive temporary authorization state |
| Prompts, conversation history, images, tool schemas and tool results | Sent from DSH through the gateway and Python protocol service to the upstream service for inference |
| Request diagnostics | Written on the service host by the pinned upstream implementation and service supervisor |

The plugin does not implement analytics collection. This does not describe telemetry, storage, or retention by DSH, the gateway operator, WorkBuddy, or model providers. Operators must document their own hosting region, access policy, retention, deletion process, and subprocessors before offering a managed service.

## Credentials and Retention

New session records use atomic replacement with owner-only file mode `0600`. The file contains readable tokens; file permissions are not encryption at rest. Use the deployment platform's secret management and storage controls, and protect backups with the same care as live credentials.

Sign-out deletes the configured session file and clears this process's authorization. It does not revoke other devices or remove backup copies, logs, or upstream data. Uninstalling without signing out retains credentials. After suspected compromise, stop access, rotate the gateway credential, use upstream account controls to revoke affected authorization, and reconnect only after resolving the incident.

The pinned protocol implementation defaults to summary logging with verbose LLM logging disabled. Verbose logging can record request and response content. Review gateway and supervisor logging too; never collect Authorization headers, cookies, authorization URLs, raw prompts, tool results, or credential files for routine support. Agree a log retention and rotation policy before unattended operation; the protocol JSONL file needs its own rotation policy.
