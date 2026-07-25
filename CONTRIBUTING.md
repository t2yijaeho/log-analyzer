# Contributing

Use Node.js 24 or newer.

1. Run `npm install`.
2. Make focused changes in the appropriate workspace.
3. Run `npm run check`.
4. Do not commit `.env`, generated output, dependencies, browser traces, or private logs.

Parser and fixture changes must preserve the manifest checksums and update expected tests. Dashboard changes must keep static GitHub Pages mode functional without an API.
