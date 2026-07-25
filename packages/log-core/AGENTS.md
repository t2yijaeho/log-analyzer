# Log core guidance

- Use the `change-log-core` skill for parser, analytics, shared types, and fixture changes.
- Keep `src` free of Node-only runtime APIs.
- Update the fixture manifest and expected tests together.
- Preserve defensive parsing, deterministic correlation, capped diagnostics, and stable public exports.
- Verify with `npm run fixtures:verify`, `npm run typecheck -w @log-analyzer/core`, and `npm run test -w @log-analyzer/core`.
