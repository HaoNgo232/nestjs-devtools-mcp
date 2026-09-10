export enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
}

export interface PaginationParams {
  limit?: number
  offset?: number
}

export interface PaginatedResult<T> {
  total_count: number
  has_more: boolean
  next_offset?: number | null
  items: T[]
}

export interface ToolTextContent {
  type: 'text'
  text: string
}

export interface ToolResult {
  [x: string]: unknown
  content: ToolTextContent[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export interface NestServerInfo {
  port: number
  pid: number
  name: string
  version: string
  uptime: number
  healthUrl: string
}
