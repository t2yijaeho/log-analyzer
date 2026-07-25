# AGENTS.md

## Repository map

- `apps/web`: Vite + React dashboard. GitHub Pages uses static mode; a protected deployment uses full mode.
- `apps/api`: Express API, remote log fetching, sessions, and OpenAI Agents chat.
- `packages/log-core`: browser-safe parsing, correlation, analytics, public types, and canonical fixtures.
- `.agents/skills`: reusable repository release workflow.
- `.codex/agents`: focused project subagents for final reviews.

Closer `AGENTS.md` files apply inside each workspace.

## Commands

- Install: `npm install`
- Develop all workspaces: `npm run dev`
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Build all targets: `npm run build`
- Build GitHub Pages: `npm run build:pages`
- Full release gate: `npm run check`

Use the root commands rather than running an unscoped TypeScript invocation.

## Engineering rules

- Import shared log types and analytics from `@log-analyzer/core`; do not duplicate the contract.
- Keep the core package browser-safe.
- Preserve both frontend modes: `static` must not require secrets or an API; `full` may use the protected API.
- Keep all three sample buttons backed by committed fixtures, with Signal 2 as the initial sample.
- Never commit `.env`, credentials, generated output, dependencies, browser traces, or local settings.
- Keep API mutation endpoints authenticated in production. Preserve exact-host fetch allowlisting and redirect validation.
- Do not deploy the full-stack service until the exposed-in-chat OpenAI key has been rotated.

## Delegation and done criteria

For a public release, use the project `security_reviewer`, `dashboard_reviewer`, and `release_verifier` agents in parallel, wait for all three, resolve material findings, and rerun `npm run check`.

Work is done only when relevant tests pass, the workspace typechecks, production builds succeed, and public-facing documentation matches behavior.
