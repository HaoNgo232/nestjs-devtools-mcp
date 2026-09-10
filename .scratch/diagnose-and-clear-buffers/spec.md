# Feature Specification: One-Shot Health Diagnosis & Buffer Clearing Tools

## Problem Statement

When an engineer or an AI agent investigates an issue in a running NestJS application, they currently endure a multi-turn, high-latency diagnostic loop. An agent must call multiple tools in succession—first scanning for running servers, then retrieving errors, extracting a correlation ID, and subsequently calling logs and request history separately. This consumes excessive tokens, clutters the conversation context window, and slows down root-cause analysis.

Furthermore, all runtime buffers (logs, HTTP request traffic history, and error stacks) are currently append-only and read-only. When a developer or agent modifies code and triggers fresh requests to verify whether a bug has been fixed, residual logs and error traces from earlier executions remain present in the buffer. This stale state misleads agents into false positives, erroneously concluding that the defect persists when it has already been resolved.

## Solution

1. **`nestjs_diagnose_health` (One-Shot Diagnostic Tool)**: A single comprehensive diagnostic tool that aggregates the core runtime health of the target NestJS instance in a single round-trip. It provides server metadata (uptime, version, PID), route inventory summary, traffic status breakdown (2xx/4xx/5xx counts), and the most recent errors paired directly with their correlated log traces.
2. **`nestjs_clear_buffers` (Buffer Management & State Reset Tool)**: A control tool that clears runtime memory buffers (logs, request history, and error entries) on demand, either selectively or in full. This enables clean-slate re-testing during rapid red-green debugging cycles.

## User Stories

1. As an AI agent diagnosing an application failure, I want to call a single health diagnosis tool, so that I can see the server status, route count, and recent crash traces without making 3-4 separate tool requests.
2. As a developer debugging a 500 error, I want to see correlated log entries directly attached to the error trace in the health diagnostic response, so that I do not need to manually copy correlation request IDs between different tools.
3. As an AI agent testing a bug fix, I want to clear previous error and log buffers, so that new test requests produce clean diagnostic output without interference from pre-fix failures.
4. As an engineer verifying a newly added endpoint, I want to inspect high-level traffic status distributions (ratio of 2xx vs 4xx vs 5xx), so that I can quickly verify overall API stability.
5. As a developer with long-running development servers, I want to reset only the request history buffer while retaining server startup logs, so that I can focus on my latest feature workflow without losing initial bootstrap context.
6. As an AI agent with constrained token limits, I want the health diagnosis tool to return a concise, prioritized Markdown summary, so that critical error context fits comfortably within my prompt window.
7. As an automated test script running regression checks, I want to clear all buffers before each test scenario, so that each test assertion runs against isolated, deterministic buffer state.
8. As a developer using a terminal or AI chat client, I want `nestjs_clear_buffers` to confirm exactly how many records were purged from each buffer, so that I have immediate feedback that state reset succeeded.
9. As an AI agent interacting with multiple NestJS instances, I want both tools to support explicit port targeting and auto-detection, so that the commands work seamlessly in both single-app and multi-app environments.
10. As a developer inspecting system health, I want to choose between formatted human-readable Markdown and machine-parsable JSON, so that the output can be consumed both visually and programmatically.
11. As an engineer encountering an offline or unreachable NestJS application, I want actionable troubleshooting advice when calling the diagnostic tool, so that I immediately know how to restart or configure the target service.
12. As a developer who mistakenly triggers buffer clearing, I want the tool to be safe and idempotent, so that running it multiple times consecutively causes no application instability or side effects.

## Implementation Decisions

### 1. Plugin Layer Capabilities (`@nestjs-devtools-mcp/plugin`)
- Expose clear/reset capabilities in the existing memory buffers (`LogBufferService`, `RequestHistoryBufferService`, `ErrorBufferService`).
- Provide atomic clearing methods on each buffer service (e.g., `clear()`) that empty internal arrays and reset buffer counters while keeping capacity limits intact.
- Add an internal HTTP endpoint `POST /_dev/mcp/tools/clear_buffers` accepting target parameters (`all`, `logs`, `history`, `errors`).
- Add an internal HTTP endpoint `POST /_dev/mcp/tools/diagnose_health` that gathers telemetry concurrently from the existing collectors in a single response payload.

### 2. MCP Server Layer Tools (`nestjs-devtools-mcp`)
- Register `nestjs_diagnose_health`:
  - Input Schema: `port` (optional number), `recent_errors_limit` (optional number, default: 3, max: 10), `response_format` ('markdown' | 'json', default: 'markdown').
  - Annotations: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`.
  - Output: Rich Markdown summary including server uptime, total routes registered, traffic distribution breakdown (last N requests), and recent errors with correlated log lines. Structured content returning complete telemetry object.
- Register `nestjs_clear_buffers`:
  - Input Schema: `port` (optional number), `target` (enum: `'all'`, `'logs'`, `'history'`, `'errors'`, default: `'all'`).
  - Annotations: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true`, `openWorldHint: false`.
  - Output: Confirmation message detailing counts of cleared records across target buffers.

### 3. Architecture & Boundary Rules
- Maintain strict package separation: The plugin continues to gather metrics inside NestJS without importing the MCP SDK; the MCP bridge routes tool calls to the plugin endpoints over localhost HTTP.
- Preserve zero-code compatibility: Both tools leverage existing plugin collectors with zero configuration or code modifications required from end-user projects.
- Safeguard production behavior: Both endpoints remain protected by the localhost-only guard and default disabled behavior in production mode.

## Testing Decisions

- **Seam Strategy**: The primary test seam is the MCP tool interface (`McpServer.registerTool` handlers) exercising end-to-end parameter parsing, proxy forwarding, dual Markdown/JSON formatting, and error handling.
- **Unit Testing**:
  - Plugin layer tests for buffer clearing behavior across `LogBufferService`, `RequestHistoryBufferService`, and `ErrorBufferService`.
  - Server layer tests for `nestjs_diagnose_health` and `nestjs_clear_buffers` verifying schema validation, proxy invocation, and output envelope.
- **E2E Integration Testing**:
  - Test against running real app fixture (`test-nestjs-app`), executing traffic, triggering crashes, running `nestjs_diagnose_health`, and verifying that `nestjs_clear_buffers` resets state so subsequent calls report zero errors.
- **Prior Art**: Follow existing patterns established in `observability.tool.spec.ts` and `e2e-zero-code.spec.ts`.

## Out of Scope

- Modifying NestJS application configurations, environment variables, or database state dynamically at runtime.
- Long-term persistent storage or file exportation of buffers (DevTools buffers remain in-memory Ring Buffers).
- Exposing remote network access to DevTools endpoints beyond localhost.
- Live streaming WebSockets for diagnostic metrics (tools follow the standard MCP request-response paradigm).

## Further Notes

- `nestjs_clear_buffers` should be marked with `destructiveHint: true` according to MCP annotations standards, informing clients that in-memory telemetry will be discarded.
- In `nestjs_diagnose_health`, log correlation is performed via `requestId`. If an error entry does not have a correlated `requestId`, it displays general context logs closest in timestamp.
