# Transitive compatibility patch

`@openai/agents` imports the optional MCP SDK at module load. MCP SDK 1.29.0
declares `@hono/node-server` 1.x, whose latest release remains covered by
GHSA-frvp-7c67-39w9.

The root dependency and lockfile pin the patched Hono 2.0.11 release. The
patch-package patch updates only MCP SDK's dependency range so npm recognizes
the resolved tree as valid. Log Analyzer does not use MCP server functionality.
Remove this patch when an upstream MCP SDK release accepts Hono 2.x.
