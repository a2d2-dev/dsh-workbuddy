# Contributing

DSH WorkBuddy is an independent, early-stage integration. Contributions should preserve the existing DSH adapter and the pinned upstream protocol implementation. Discuss substantial architecture or dependency changes in an issue before implementation.

## Development Setup

Use Node.js `^22.19.0 || >=24.0.0` and pnpm. The repository lockfile is the dependency baseline; do not manually edit generated bundles or lockfiles.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

Python account and pricing tests require the separately installed upstream project. Check out `Zhengyuuuui/workbuddy2api` at `1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc`, run `uv sync` there, and use its virtual environment:

```sh
PYTHONPATH=/absolute/path/to/dsh-workbuddy/server:/absolute/path/to/workbuddy2api/server \
  /absolute/path/to/workbuddy2api/.venv/bin/python -m pytest \
  server/test_session.py server/test_pricing.py
```

The pinned upstream repository does not commit `uv.lock`. Record the resolved Python versions when reporting test results; pinning its source revision alone does not freeze its Python dependencies. The plugin tests use fake account data and do not need a live WorkBuddy account.

## Change Requirements

- Keep files below 1,000 lines and functions below 50 lines; document function purpose, parameters, and results.
- Trace API responses through conversion, hooks, and rendering when investigating data or UI bugs.
- Add regression coverage for meaningful behavior changes, using sanitized fixtures. Unknown prices must remain unknown, and independent conversations must stay isolated.
- Keep English and Chinese interface dictionaries consistent. Account metadata and provider labels also need language review.
- Preserve server-side authorization, browser ownership of pending login, and credential redaction. Never include real tokens, account records, gateway keys, or private deployment addresses in fixtures, logs, screenshots, issues, or PRs.
- Update installation and operator documentation when configuration or behavior changes.

## Pull Requests

Explain the problem, resulting behavior, and commands used to verify it. Mention any live acceptance steps that were not run. Use the [operator checklist](docs/OPERATIONS.md) for changes affecting authorization, streaming, tool calls, or deployment.

Package changes need `pnpm pack` inspection as well as a successful build. Check that required assets and guides are included and generated caches or credentials are excluded. Build outputs belong in release artifacts, not hand-edited source commits.

Contributions are submitted under the project's [Apache-2.0 license](LICENSE). Retain the notices and licenses of any third-party code you redistribute.
