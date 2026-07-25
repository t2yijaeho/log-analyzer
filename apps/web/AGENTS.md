# Web workspace guidance

- Use the `work-on-dashboard` skill for dashboard and deployment-mode changes.
- Keep static mode fully functional without an API, credentials, or runtime sample downloads.
- Preserve keyboard-accessible controls, responsive layout, and clear loading/error states.
- Keep Three.js behind the lazy 3D boundary.
- Verify web changes with `npm run typecheck -w @log-analyzer/web`, `npm run test -w @log-analyzer/web`, and `npm run build:pages`.
