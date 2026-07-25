---
name: change-log-core
description: Maintain the browser-safe log parsing and analytics package. Use for log format changes, correlation rules, latency statistics, outcome calculations, shared types, fixture updates, or parser and analytics tests.
---

# Change Log Core

1. Keep production code browser-safe: do not import Node-only modules from `src`.
2. Preserve the strict parser followed by the defensive key-value fallback.
3. Keep correlation deterministic and ordered by request time. Report malformed data through capped warnings and anomalies instead of silently discarding it.
4. Update `fixtures/manifest.json` whenever a fixture changes and run `npm run fixtures:verify`.
5. Treat Signal 1, Signal 2, and Signal 3 as canonical public fixtures and retain their expected outcome and latency assertions.
6. Export public types and functions through `src/index.ts`; consumers must not import internal paths.
7. Verify with `npm run typecheck -w @log-analyzer/core`, `npm run test -w @log-analyzer/core`, and `npm run build -w @log-analyzer/core`.
