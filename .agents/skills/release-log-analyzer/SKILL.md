---
name: release-log-analyzer
description: Validate and publish Log Analyzer releases. Use for public-release checks, GitHub publication, GitHub Pages deployment, release-readiness reviews, or changes to CI and deployment configuration in this repository.
---

# Release Log Analyzer

1. Read the root `AGENTS.md`, `README.md`, and `SECURITY.md`.
2. Run `npm run check`. Fix failures before external publication.
3. Inspect `git status --short` and the complete staged diff. Never stage `.env`, dependencies, build outputs, traces, coverage, or local settings.
4. Delegate independent final passes to the project `security_reviewer`, `dashboard_reviewer`, and `release_verifier` agents. Wait for all three and resolve material findings.
5. Run `npm run check` again after fixes.
6. Push only the reviewed commit. Wait for CI and Pages to complete, then verify the public repository visibility and deployed URL.
7. Do not deploy the optional full-stack service unless the user explicitly requests it and confirms that the exposed OpenAI key has been rotated.
