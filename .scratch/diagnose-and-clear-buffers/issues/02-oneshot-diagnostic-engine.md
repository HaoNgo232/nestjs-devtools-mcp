# 02: One-Shot Diagnostic Engine (nestjs_diagnose_health)

**What to build:**
Deliver an aggregated runtime health diagnostic capability that returns critical application metrics in a single round-trip. The plugin aggregates server instance metadata, total route counts, traffic status distribution (2xx/4xx/5xx), and recent errors automatically correlated with log snippets sharing the same correlation request ID. The MCP server registers `nestjs_diagnose_health` with rich Markdown and structured JSON output.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Plugin implements `diagnose_health` endpoint collecting server info, route count, traffic breakdown, and recent errors with correlated logs
- [x] Server defines `DiagnoseHealthInputSchema` supporting recent error limits and output formats
- [x] Tool registered as `nestjs_diagnose_health` with `readOnlyHint: true` and `idempotentHint: true`
- [x] Rich Markdown formatting visualizes server status badges, traffic ratio tables, and error-log correlation blocks
- [x] Structured content returns complete diagnostic model for programmatic consumers
- [x] Actionable error handling guides users if server is unreachable
- [x] Unit tests verify end-to-end telemetry aggregation, formatting, and correlation logic
