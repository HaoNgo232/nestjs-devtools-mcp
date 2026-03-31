/* ================================================================
 * MCP API Contract — Bridge Side (Mirror)
 *
 * MIRROR của packages/plugin/src/contracts/mcp-api.contract.ts
 * Khi plugin side thay đổi contract, file này PHẢI được cập nhật đồng bộ.
 *
 * KHÔNG import trực tiếp từ @nestjs-devtools-mcp/plugin.
 * Bridge package KHÔNG BAO GIỜ phụ thuộc vào NestJS packages.
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

/** POST /_dev/mcp/tools/get_logs — Response body */
export interface McpGetLogsResponse {
  readonly server: string;
  readonly totalLogs: number;
  readonly returnedLogs: number;
  readonly logs: ReadonlyArray<McpLogEntry>;
}

/** Envelope lỗi chung */
export interface McpErrorResponse {
  readonly error: string;
  readonly message: string;
  readonly timestamp: string;
}