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
  readonly timestamp: number
  readonly level: 'log' | 'error' | 'warn' | 'debug' | 'verbose'
  readonly context: string
  readonly message: string
  readonly requestId: string | null
}

/** POST /_dev/mcp/tools/get_logs — Request body */
export interface McpGetLogsRequest {
  readonly lines?: number
  readonly level?: McpLogEntry['level'] | 'all'
  readonly requestId?: string | null
}

/** POST /_dev/mcp/tools/get_logs — Response body */
export interface McpGetLogsResponse {
  readonly entries: ReadonlyArray<McpLogEntry>
  readonly total: number
  readonly bufferSize: number
}

/** Route information returned by get_routes tool */
export interface McpRouteInfo {
  readonly method: string
  readonly path: string
  readonly controllerName: string
  readonly handlerName: string
}

/** POST /_dev/mcp/tools/get_routes — Response body */
export interface McpGetRoutesResponse {
  readonly routes: ReadonlyArray<McpRouteInfo>
  readonly total: number
}

export interface RequestHistoryEntry {
  readonly timestamp: number
  readonly method: string
  readonly path: string
  readonly routePattern: string | null
  readonly statusCode: number
  readonly durationMs: number
  readonly controllerName: string | null
  readonly handlerName: string | null
  readonly ip: string
  readonly userAgent: string | null
  readonly requestSize: number | null
  readonly responseSize: number | null
  readonly error: {
    readonly name: string
    readonly message: string
    readonly stack: string | null
  } | null
  readonly requestId: string | null
}

/** POST /_dev/mcp/tools/get_request_history — Request body */
export interface McpGetRequestHistoryRequest {
  readonly limit?: number
  readonly method?: string
  readonly statusCode?: number
  readonly statusClass?: '2xx' | '3xx' | '4xx' | '5xx'
  readonly pathContains?: string
  readonly minDurationMs?: number
  readonly onlyErrors?: boolean
}

/** POST /_dev/mcp/tools/get_request_history — Response body */
export interface McpGetRequestHistoryResponse {
  readonly entries: ReadonlyArray<RequestHistoryEntry>
  readonly total: number
  readonly bufferSize: number
  readonly capturedSince: string | null
}

export interface ConfigEntry {
  readonly key: string
  readonly source: 'env' | 'config-service'
  readonly status?: 'set' | 'empty' | 'masked'
  readonly value: string | number | boolean | null
  readonly masked: boolean
  readonly type: 'string' | 'number' | 'boolean' | 'object' | 'null' | 'undefined'
}

/** POST /_dev/mcp/tools/get_config — Request body */
export interface McpGetConfigRequest {
  readonly source?: 'all' | 'env' | 'config-service'
  readonly keyContains?: string
  readonly includeMasked?: boolean
}

/** POST /_dev/mcp/tools/get_config — Response body */
export interface McpGetConfigResponse {
  readonly entries: ReadonlyArray<ConfigEntry>
  readonly total: number
  readonly configServiceAvailable: boolean
  readonly nodeEnv: string
  readonly warnings: ReadonlyArray<string>
}

/** Common error envelope for all endpoints when an exception occurs */
export interface McpErrorResponse {
  readonly error: string
  readonly message: string
  readonly timestamp: string
}

/** Phân loại nguồn error */
export type ErrorSource = 'bootstrap' | 'runtime' | 'unhandled' | 'http-5xx'

/** Một entry error trong buffer */
export interface McpErrorEntry {
  readonly id: string
  readonly timestamp: number
  readonly source: ErrorSource
  readonly name: string
  readonly message: string
  readonly stack: string | null
  readonly context: string | null
  readonly requestId: string | null
  /** Link tới log entry liên quan (nếu error đến từ Logger), dùng để AI join data */
  readonly relatedLogTimestamp: number | null
}

/** POST /_dev/mcp/tools/get_errors — Request body */
export interface McpGetErrorsRequest {
  readonly limit?: number
  readonly source?: ErrorSource
  readonly since?: number
  readonly requestId?: string
  readonly onlyUnhandled?: boolean
  readonly includeStack?: boolean
}

/** POST /_dev/mcp/tools/get_errors — Response body */
export interface McpGetErrorsResponse {
  readonly entries: ReadonlyArray<McpErrorEntry>
  readonly total: number
  readonly bufferSize: number
  readonly unhandledCount: number
  readonly capturedSince: string | null
}
