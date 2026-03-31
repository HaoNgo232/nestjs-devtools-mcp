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
   * Application name reported to the bridge for discovery.
   * Automatically detected from host app package.json by default.
   */
  name?: string
}

export const DEVTOOLS_OPTIONS_TOKEN = 'DEVTOOLS_MCP_OPTIONS'
