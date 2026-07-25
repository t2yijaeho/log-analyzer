---
name: work-on-log-api
description: Change and secure the Log Analyzer Express and OpenAI Agents API. Use for log fetching, authentication, sessions, rate limits, chat streaming, agent tools, security headers, production configuration, or full-stack deployment behavior.
---

# Work On Log API

1. Keep health and preset metadata public. Require the configured bearer token for log loading and chat.
2. Preserve exact-host URL allowlisting, HTTPS-only production fetches, credential and IP-literal rejection, redirect revalidation, timeouts, and byte limits.
3. Keep sessions bounded and agent tools read-only. Never expose raw log text to the model.
4. Redact credentials from all errors and logs.
5. Preserve the `/api/logs` JSON contract and `/api/chat` SSE event contract unless the user explicitly requests a breaking change.
6. Keep model and reasoning settings configurable through environment variables.
7. Verify with `npm run typecheck -w @log-analyzer/api`, `npm run test -w @log-analyzer/api`, and `npm run build -w @log-analyzer/api`.
