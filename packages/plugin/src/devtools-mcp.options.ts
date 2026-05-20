export interface DevtoolsMcpOptions {
  /**
   * Endpoint path for the bridge to connect to
   * @default '/_dev/mcp'
   */
  endpoint?: string

  /**
   * Disable plugin. Automatically disabled when NODE_ENV === 'production' by default.
   * @default process.env.NODE_ENV === 'production'
   */
  disabled?: boolean

  /**
   * Maximum number of log entries stored in the buffer
   * @default 500
   */
  logBufferSize?: number

  /**
   * Maximum number of HTTP request history entries stored in the buffer.
   * @default 100
   */
  requestHistorySize?: number

  /**
   * Capture sanitized request bodies for local debugging.
   * Disabled by default because request bodies often contain PII or large payloads.
   * Multipart request bodies are never captured.
   * @default false
   */
  captureRequestBody?: boolean

  /**
   * Application name reported to the bridge for discovery.
   * Automatically detected from host app package.json by default.
   */
  name?: string
}

export const DEVTOOLS_OPTIONS_TOKEN = 'DEVTOOLS_MCP_OPTIONS'
