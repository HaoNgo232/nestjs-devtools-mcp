/* ================================================================
 * MCP API Contract — Plugin Side (Source of Truth)
 *
 * Every response from /_dev/mcp/* endpoints MUST conform with these types.
 * When a type is changed here, it MUST be mirrored in packages/server/src/contracts/.
 * ================================================================ */

/** GET /_dev/mcp/health */
export interface McpHealthResponse {
  readonly status: 'ok';
  readonly module: string;
  readonly timestamp: string;
  readonly tools: ReadonlyArray<string>;
}

/** A log line in the buffer */
export interface McpLogEntry {
  readonly timestamp: string;
  readonly level: 'log' | 'error' | 'warn' | 'debug' | 'verbose';
  readonly context: string;
  readonly message: string;
}

/** POST /_dev/mcp/tools/get_logs — Request body */
export interface McpGetLogsRequest {
  readonly limit?: number;
  readonly level?: McpLogEntry['level'];
}

/** POST /_dev/mcp/tools/get_logs — Response body */
export interface McpGetLogsResponse {
  readonly server: string;
  readonly totalLogs: number;
  readonly returnedLogs: number;
  readonly logs: ReadonlyArray<McpLogEntry>;
}

/** Common error envelope for all endpoints when an exception occurs */
export interface McpErrorResponse {
  readonly error: string;
  readonly message: string;
  readonly timestamp: string;
}