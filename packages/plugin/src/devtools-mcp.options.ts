export interface DevtoolsMcpOptions {
  /**
   * Đường dẫn endpoint để bridge có thể kết nối
   * @default '/_dev/mcp'
   */
  endpoint?: string;

  /**
   * Disable plugin. Mặc định tự tắt khi NODE_ENV === 'production'
   * @default process.env.NODE_ENV === 'production'
   */
  disabled?: boolean;

  /**
   * Số lượng log entry tối đa được lưu trữ trong buffer
   * @default 500
   */
  logBufferSize?: number;
}

export const DEVTOOLS_OPTIONS_TOKEN = 'DEVTOOLS_MCP_OPTIONS';
