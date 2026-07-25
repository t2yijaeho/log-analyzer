---
name: work-on-dashboard
description: Build and verify the Log Analyzer React dashboard. Use for changes to sample buttons, local file or URL loading, 2D or 3D visualizations, static GitHub Pages mode, full-stack API mode, accessibility, responsive layout, or frontend performance.
---

# Work On Dashboard

1. Preserve two explicit modes: `static` for GitHub Pages and `full` for the protected API.
2. Keep Signal 1, Signal 2, and Signal 3 sourced from the committed core fixtures. Never make their buttons depend on live network access.
3. Parse opened files locally. Never send file contents to the API or model.
4. Keep Signal 2 as the initial sample and 2D as the initial visualization.
5. Lazy-load the 3D implementation so Three.js is absent from the initial dashboard chunk.
6. Import shared parser types and functions from `@log-analyzer/core`; do not duplicate the API data model.
7. Verify with `npm run typecheck -w @log-analyzer/web`, `npm run test -w @log-analyzer/web`, and `npm run build:pages`.
