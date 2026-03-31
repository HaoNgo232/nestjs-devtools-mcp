/* ================================================================
 * MCP API Contract — Plugin Side (Source of Truth)
 *
 * Mọi response từ /_dev/mcp/* endpoints PHẢI conform với các types này.
 * Khi sửa type ở đây, PHẢI cập nhật mirror bên packages/server/src/contracts/.
 * ================================================================ */

/** GET /_dev/mcp/health */
export interface McpHealthResponse {
  readonly status: 'ok';
  readonly module: string;
  readonly timestamp: string;
  readonly tools: ReadonlyArray<string>;
}

/** Một dòng log trong buffer */
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

/** Envelope lỗi chung cho mọi endpoint khi có exception */
export interface McpErrorResponse {
  readonly error: string;
  readonly message: string;
  readonly timestamp: string;
}