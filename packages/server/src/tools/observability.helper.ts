import { ToolResult } from '../types.js'
import { McpLogEntry, RequestHistoryEntry, McpErrorEntry } from '../contracts/mcp-api.contract.js'

export interface PaginatedResult<T> {
  total_count: number
  has_more: boolean
  next_offset: number | null
  items: T[]
}

/**
 * Enforces pagination slicing and computes total_count, has_more, next_offset.
 */
export function paginateEntries<T>(
  entries: T[],
  total: number | undefined,
  offset: number,
  limit: number,
): PaginatedResult<T> {
  const safeOffset = Math.max(0, offset)
  const safeLimit = Math.max(1, limit)
  const effectiveTotal = typeof total === 'number' && total >= entries.length ? total : entries.length

  const items = entries.slice(safeOffset, safeOffset + safeLimit)
  const hasMore = items.length > 0 && safeOffset + items.length < effectiveTotal
  const nextOffset = hasMore ? safeOffset + items.length : null

  return {
    total_count: effectiveTotal,
    has_more: hasMore,
    next_offset: nextOffset,
    items,
  }
}

export function formatPaginationFooter(itemsCount: number, totalCount: number, offset: number): string {
  return `Showing ${itemsCount} of ${totalCount} items, page offset ${offset}`
}

export function formatTimestamp(ts: number | string): string {
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return String(ts)
    return d.toISOString()
  } catch {
    return String(ts)
  }
}

/**
 * Format log stream into readable markdown with level badges and correlation IDs.
 */
export function formatLogsMarkdown(envelope: PaginatedResult<McpLogEntry>, offset: number): string {
  const lines: string[] = ['### NestJS Runtime Logs', '']

  if (envelope.items.length === 0) {
    lines.push('No log entries found matching criteria.')
  } else {
    for (const entry of envelope.items) {
      const levelUpper = (entry.level || 'LOG').toUpperCase()
      let levelBadge = `[${levelUpper}]`
      if (levelUpper === 'ERROR') levelBadge = `🔴 [${levelUpper}]`
      else if (levelUpper === 'WARN') levelBadge = `🟡 [${levelUpper}]`
      else if (levelUpper === 'LOG') levelBadge = `🟢 [${levelUpper}]`
      else if (levelUpper === 'DEBUG') levelBadge = `🔵 [${levelUpper}]`
      else if (levelUpper === 'VERBOSE') levelBadge = `⚪ [${levelUpper}]`

      const timeStr = formatTimestamp(entry.timestamp)
      const contextStr = entry.context ? `[${entry.context}]` : ''
      const reqStr = entry.requestId ? ` *(req: \`${entry.requestId}\`)*` : ''

      lines.push(`\`${timeStr}\` ${levelBadge} ${contextStr} ${entry.message}${reqStr}`)

      const entryWithTrace = entry as { trace?: string }
      if (entry.requestId && entryWithTrace.trace) {
        lines.push(`> **Trace:** ${entryWithTrace.trace}`)
      }
    }
  }

  lines.push('')
  lines.push(formatPaginationFooter(envelope.items.length, envelope.total_count, offset))
  return lines.join('\n')
}

export function getStatusBadge(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return `🟢 ${statusCode}`
  if (statusCode >= 300 && statusCode < 400) return `🔵 ${statusCode}`
  if (statusCode >= 400 && statusCode < 500) return `🟡 ${statusCode}`
  if (statusCode >= 500) return `🔴 ${statusCode}`
  return `⚪ ${statusCode}`
}

/**
 * Format HTTP request history into markdown table with status badges and error callouts.
 */
export function formatRequestHistoryMarkdown(envelope: PaginatedResult<RequestHistoryEntry>, offset: number): string {
  const lines: string[] = ['### NestJS Request History', '']

  if (envelope.items.length === 0) {
    lines.push('No request history entries found matching criteria.')
  } else {
    lines.push('| Status | Method | Path | Duration | Controller.Handler | Request ID |')
    lines.push('|--------|--------|------|----------|-------------------|------------|')

    const errorSummaries: string[] = []

    for (const req of envelope.items) {
      const statusBadge = getStatusBadge(req.statusCode)
      const methodStr = `\`${req.method}\``
      const pathStr = `\`${req.path}\``
      const durationStr = `${req.durationMs}ms`
      const handlerStr =
        req.controllerName || req.handlerName ? `\`${req.controllerName ?? '?'}.${req.handlerName ?? '?'}\`` : '-'
      const reqIdStr = req.requestId ? `\`${req.requestId}\`` : '-'

      lines.push(`| ${statusBadge} | ${methodStr} | ${pathStr} | ${durationStr} | ${handlerStr} | ${reqIdStr} |`)

      if (req.error) {
        errorSummaries.push(`> ⚠️ **Error in ${req.method} ${req.path}**: \`${req.error.name}\` - ${req.error.message}`)
      }
    }

    if (errorSummaries.length > 0) {
      lines.push('')
      lines.push(...errorSummaries)
    }
  }

  lines.push('')
  lines.push(formatPaginationFooter(envelope.items.length, envelope.total_count, offset))
  return lines.join('\n')
}

export function getErrorSourceBadge(source: string): string {
  switch (source) {
    case 'bootstrap':
      return '💥 [bootstrap]'
    case 'unhandled':
      return '🔴 [unhandled]'
    case 'http-5xx':
      return '🌐 [http-5xx]'
    case 'runtime':
    default:
      return '⚠️ [runtime]'
  }
}

/**
 * Format runtime errors into markdown with origin badges and stack trace summaries.
 */
export function formatErrorsMarkdown(envelope: PaginatedResult<McpErrorEntry>, offset: number): string {
  const lines: string[] = ['### NestJS Runtime Errors', '']

  if (envelope.items.length === 0) {
    lines.push('No runtime error entries found matching criteria.')
  } else {
    for (const err of envelope.items) {
      const badge = getErrorSourceBadge(err.source)
      const timeStr = formatTimestamp(err.timestamp)
      const contextStr = err.context ? ` [${err.context}]` : ''
      const reqStr = err.requestId ? ` *(req: \`${err.requestId}\`)*` : ''

      lines.push(`#### ${badge} ${err.name}: ${err.message}`)
      lines.push(`- **Timestamp:** \`${timeStr}\`${contextStr}${reqStr}`)

      if (err.stack) {
        lines.push('```text')
        lines.push(err.stack)
        lines.push('```')
      }
      lines.push('')
    }
  }

  lines.push(formatPaginationFooter(envelope.items.length, envelope.total_count, offset))
  return lines.join('\n')
}

/**
 * Returns actionable troubleshooting error response.
 */
export function createActionableError(toolName: string, error: unknown): ToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const guidance = [
    `Failed to execute ${toolName}: ${errorMessage}`,
    '',
    'Actionable Guidance:',
    '1. Ensure your NestJS application is running and accessible (e.g. `npm run start:dev`).',
    '2. Verify that DevtoolsMcpModule is registered in the NestJS application or run `npx nestjs-devtools-mcp init` for zero-code preload.',
    '3. Check available instances with `nestjs_discover_servers` or specify the `port` argument explicitly.',
  ].join('\n')

  return {
    content: [{ type: 'text', text: guidance }],
    isError: true,
  }
}
