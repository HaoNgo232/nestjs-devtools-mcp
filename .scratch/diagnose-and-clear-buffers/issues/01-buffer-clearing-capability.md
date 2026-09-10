# 01: Buffer Clearing Capability (nestjs_clear_buffers)

**What to build:**
Enable developers and agents to purge in-memory telemetry buffers (logs, HTTP request traffic, error entries) on demand. Add clear methods to the plugin buffer services, expose `POST /_dev/mcp/tools/clear_buffers`, and register the `nestjs_clear_buffers` MCP tool with Zod validation, destructive annotations, and clear record-count reporting.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] `LogBufferService`, `RequestHistoryBufferService`, and `ErrorBufferService` implement atomic `clear()` methods
- [x] Plugin controller exposes `POST /_dev/mcp/tools/clear_buffers` accepting target parameter (`all`, `logs`, `history`, `errors`)
- [x] Server defines `ClearBuffersInputSchema` validating target options and port
- [x] Tool registered as `nestjs_clear_buffers` with `destructiveHint: true` and `idempotentHint: true`
- [x] Response returns confirmation text and structured content with counts of cleared entries
- [x] Unit tests in both plugin and server packages verify buffer clearing functionality
