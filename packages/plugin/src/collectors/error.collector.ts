import { Injectable, Optional } from '@nestjs/common'
import { ErrorBufferService, ErrorBufferFilters } from '../error-buffer.service'
import { LogBufferService, LogEntry } from '../log-buffer.service'
import { RequestHistoryBufferService } from '../request-history-buffer.service'
import { CollectorResult, DevtoolsCollector } from './collector.interface'
import { ErrorSource, McpErrorEntry, RequestHistoryEntry } from '../contracts/mcp-api.contract'

export interface ErrorCollectorResponse {
  entries: McpErrorEntry[]
  total: number
  bufferSize: number
  unhandledCount: number
  capturedSince: string | null
}

export interface ErrorCollectorOptions {
  includeStackInProduction?: boolean
}

const DESCRIPTION =
  'Retrieve recent runtime errors from multiple sources (bootstrap, runtime, unhandled, http-5xx) with filtering and optional stack traces.'

@Injectable()
export class ErrorCollector implements DevtoolsCollector<ErrorCollectorResponse> {
  readonly toolName = 'get_errors'
  readonly description = DESCRIPTION

  constructor(
    private readonly errorBuffer: ErrorBufferService,
    private readonly logBuffer: LogBufferService,
    private readonly requestHistoryBuffer: RequestHistoryBufferService,
    @Optional() private readonly options?: ErrorCollectorOptions,
  ) {}

  async execute(params: Record<string, unknown>): Promise<CollectorResult<ErrorCollectorResponse>> {
    const filters = this.normalizeFilters(params)
    const includeStack = this.resolveIncludeStack(params.includeStack)

    // 1. Errors from ErrorBufferService (unhandled + bootstrap)
    const errorBufferEntries = this.errorBuffer.filter(filters)

    // 2. Runtime errors from LogBuffer
    const shouldIncludeRuntime = filters.source === undefined || filters.source === 'runtime'
    const logEntries = shouldIncludeRuntime ? this.logBuffer.getLogs(filters.limit ?? 50, 'error') : []

    // 3. HTTP 5xx errors from RequestHistoryBuffer
    const shouldIncludeHttp = filters.source === undefined || filters.source === 'http-5xx'
    const httpEntries = shouldIncludeHttp ? this.requestHistoryBuffer.filter({ ...filters, onlyErrors: true }) : []

    // Merge & transform
    const merged: McpErrorEntry[] = []
    merged.push(...errorBufferEntries)
    merged.push(...logEntries.map((e) => this.fromLogEntry(e)))
    merged.push(...httpEntries.filter((e) => e.statusCode >= 500).map((e) => this.fromHttpEntry(e)))

    const total = merged.length

    // Sort by timestamp desc, cap at limit
    const limit = filters.limit ?? 50
    const sorted = merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)

    // Apply stack masking
    const finalEntries = includeStack ? sorted : sorted.map((e) => ({ ...e, stack: null }))

    const stats = this.errorBuffer.getStats()

    return {
      toolName: this.toolName,
      data: {
        entries: finalEntries,
        total,
        bufferSize: stats.bufferSize,
        unhandledCount: stats.unhandledCount,
        capturedSince: stats.capturedSince,
      },
    }
  }

  private normalizeFilters(params: Record<string, unknown>): ErrorBufferFilters {
    return {
      limit: this.normalizeLimit(params.limit),
      source: this.normalizeSource(params.source),
      since: typeof params.since === 'number' ? params.since : undefined,
      requestId:
        typeof params.requestId === 'string' || params.requestId === null
          ? (params.requestId as string | null)
          : undefined,
      onlyUnhandled: params.onlyUnhandled === true,
    }
  }

  private normalizeLimit(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 50
    return Math.min(Math.floor(value), 200)
  }

  private normalizeSource(value: unknown): ErrorSource | undefined {
    if (value === 'bootstrap' || value === 'runtime' || value === 'unhandled' || value === 'http-5xx') {
      return value
    }
    return undefined
  }

  private resolveIncludeStack(includeStack: unknown): boolean {
    if (process.env.NODE_ENV === 'production') return false
    return includeStack === true
  }

  private fromLogEntry(entry: LogEntry): McpErrorEntry {
    const timestampMs = typeof entry.timestamp === 'string' ? new Date(entry.timestamp).getTime() : entry.timestamp
    return {
      id: `log-${timestampMs}`,
      timestamp: timestampMs,
      source: 'runtime',
      name: 'Error',
      message: entry.message,
      stack: entry.trace ?? null,
      context: entry.context ?? null,
      requestId: entry.requestId ?? null,
      relatedLogTimestamp: timestampMs,
    }
  }

  private fromHttpEntry(entry: RequestHistoryEntry): McpErrorEntry {
    return {
      id: `http-${entry.timestamp}`,
      timestamp: entry.timestamp,
      source: 'http-5xx',
      name: entry.error?.name ?? 'HttpError',
      message: entry.error?.message ?? `HTTP ${entry.statusCode}`,
      stack: entry.error?.stack ?? null,
      context: entry.controllerName ?? null,
      requestId: entry.requestId ?? null,
      relatedLogTimestamp: null,
    }
  }
}
