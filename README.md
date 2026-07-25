# Log Analyzer

Interactive request-lifecycle analysis for `api_signal` logs, with a fast 2D dashboard, an optional 3D timeline, and an access-controlled AI investigation API.

**Live dashboard:** https://t2yijaeho.github.io/log-analyzer/

## Try the bundled runs

The static dashboard includes three committed, checksum-verified samples:

| Button | Scenario | Requests | Notable behavior |
| --- | --- | ---: | --- |
| Signal 1 | Healthy baseline | 500 | All requests return successfully |
| Signal 2 | Degraded run | 500 | 40 errors and 30 timeouts |
| Signal 3 | Long-tail latency | 500 | All succeed, but p99 reaches 14.5s |

Signal 2 opens automatically. You can also open a local `.log` or `.txt` file; its contents stay in your browser.

## Architecture

```text
apps/web          React dashboard; static and full-stack modes
apps/api          Express API, protected log fetch, sessions, AI chat
packages/log-core Browser-safe parser, correlation, analytics, fixtures
```

The model never receives raw log text. It can use bounded, read-only analytics tools over already-parsed data.

## Local development

Requirements: Node.js 24 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Set `OPENAI_API_KEY` and a 16-character-or-longer `APP_ACCESS_TOKEN` in `.env` to use full mode. The web app runs on `http://localhost:5175`; the API defaults to `http://localhost:3001`.

Useful commands:

```bash
npm run typecheck
npm test
npm run build
npm run build:pages
npm run check
```

## Deployment

GitHub Pages builds `apps/web` in static mode. It needs no API key and loads the three bundled samples from its own assets.

For the optional AI experience, use the included `render.yaml` as a starting point for a protected Render web service. Provide a newly rotated `OPENAI_API_KEY` and a strong `APP_ACCESS_TOKEN`. The full-stack API is intended for personal or controlled access, not anonymous multi-tenant use.

## Security

See [SECURITY.md](./SECURITY.md). Remote API fetching is restricted to exact configured hosts, redirects are revalidated, production requires HTTPS and bearer authentication, and request/session sizes are bounded.

## License

[MIT](./LICENSE)
