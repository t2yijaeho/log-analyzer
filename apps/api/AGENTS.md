# API workspace guidance

- Use the `work-on-log-api` skill for API and agent changes.
- Keep `/api/health` and `/api/logs/presets` public; protect log loading and chat.
- Treat remote URLs as untrusted. Preserve protocol, host, redirect, size, and timeout controls.
- Never log credentials or pass raw log text to the model.
- Verify API changes with `npm run typecheck -w @log-analyzer/api`, `npm run test -w @log-analyzer/api`, and `npm run build -w @log-analyzer/api`.
