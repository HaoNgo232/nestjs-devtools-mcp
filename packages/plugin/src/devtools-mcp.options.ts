export interface DevtoolsMcpOptions {
  /**
   * Endpoint path for the bridge to connect to
   * @default '/_dev/mcp'
   */
  endpoint?: string;

  /**
   * Disable plugin. Automatically disabled when NODE_ENV === 'production' by default.
   * @default process.env.NODE_ENV === 'production'
   */
  disabled?: boolean;

  /**
   * Maximum number of log entries stored in the buffer
   * @default 500
   */
  logBufferSize?: number;
}

export const DEVTOOLS_OPTIONS_TOKEN = 'DEVTOOLS_MCP_OPTIONS';
