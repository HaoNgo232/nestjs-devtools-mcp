/* ================================================================
 * MCP API Contract — Bridge Side (Mirror)
 *
 * MIRROR of packages/plugin/src/contracts/mcp-api.contract.ts
 * When the plugin side changes the contract, this file MUST be updated in sync.
 *
 * DO NOT import directly from @nestjs-devtools-mcp/plugin.
 * The bridge package NEVER depends on NestJS packages.
 * ================================================================ */

/** GET /_dev/mcp/health */
export interface McpHealthResponse {
  readonly status: 'ok'
  readonly module: string
  readonly name: string
  readonly timestamp: string
  readonly tools: ReadonlyArray<string>
  readonly pid: number
  readonly uptime: number
}

/** A log line in the buffer */
export interface McpLogEntry {
  readonly timestamp: string
  readonly level: 'log' | 'error' | 'warn' | 'debug' | 'verbose'
  readonly context: string
  readonly message: string
}

/** POST /_dev/mcp/tools/get_logs — Response body */
export interface McpGetLogsResponse {
  readonly server: string
  readonly totalLogs: number
  readonly returnedLogs: number
  readonly logs: ReadonlyArray<McpLogEntry>
}

/** Common error envelope */
export interface McpErrorResponse {
  readonly error: string
  readonly message: string
  readonly timestamp: string
}
