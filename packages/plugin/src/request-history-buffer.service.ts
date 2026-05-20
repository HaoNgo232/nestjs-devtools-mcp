import { Inject, Injectable } from '@nestjs/common'
import { RequestHistoryEntry } from './contracts/mcp-api.contract'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options'

export type RequestHistoryError = NonNullable<RequestHistoryEntry['error']>

export interface RequestHistoryFilters {
  limit?: number
  method?: string
  statusCode?: number
  statusClass?: number | string
  pathContains?: string
  minDurationMs?: number
  onlyErrors?: boolean
}

@Injectable()
export class RequestHistoryBufferService {
  private readonly buffer: RequestHistoryEntry[] = []
  private readonly maxSize: number

  constructor(
    @Inject(DEVTOOLS_OPTIONS_TOKEN)
    private readonly options: DevtoolsMcpOptions,
  ) {
    this.maxSize = this.options.requestHistorySize || 100
  }

  add(entry: Omit<RequestHistoryEntry, 'timestamp'> & { timestamp?: number }): RequestHistoryEntry {
    const requestEntry: RequestHistoryEntry = {
      ...entry,
      timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
    }

    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift()
    }

    this.buffer.push(requestEntry)
    return requestEntry
  }

  get(limit = 50): RequestHistoryEntry[] {
    return this.buffer.slice(-this.normalizeLimit(limit))
  }

  filter(filters: RequestHistoryFilters = {}): RequestHistoryEntry[] {
    const limit = this.normalizeLimit(filters.limit ?? 50)
    const method = typeof filters.method === 'string' ? filters.method.toUpperCase() : undefined
    const pathContains = typeof filters.pathContains === 'string' ? filters.pathContains : undefined
    const statusClass = this.normalizeStatusClass(filters.statusClass)

    let entries = this.buffer

    if (method) {
      entries = entries.filter((entry) => entry.method === method)
    }

    if (typeof filters.statusCode === 'number') {
      entries = entries.filter((entry) => entry.statusCode === filters.statusCode)
    }

    if (statusClass !== null) {
      entries = entries.filter((entry) => Math.floor(entry.statusCode / 100) === statusClass)
    }

    if (pathContains) {
      entries = entries.filter((entry) => entry.path.includes(pathContains))
    }

    const minDurationMs = filters.minDurationMs
    if (typeof minDurationMs === 'number') {
      entries = entries.filter((entry) => entry.durationMs >= minDurationMs)
    }

    if (filters.onlyErrors === true) {
      entries = entries.filter((entry) => entry.error !== null || entry.statusCode >= 400 || entry.statusCode === 0)
    }

    return entries.slice(-limit)
  }

  count(filters: Omit<RequestHistoryFilters, 'limit'> = {}): number {
    return this.filter({ ...filters, limit: this.maxSize }).length
  }

  getStats() {
    return {
      total: this.buffer.length,
      bufferSize: this.maxSize,
      capturedSince: this.buffer[0] ? new Date(this.buffer[0].timestamp).toISOString() : null,
    }
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit <= 0) {
      return 50
    }

    return Math.floor(limit)
  }

  private normalizeStatusClass(statusClass: RequestHistoryFilters['statusClass']): number | null {
    if (typeof statusClass === 'number' && statusClass >= 1 && statusClass <= 5) {
      return statusClass
    }

    if (typeof statusClass === 'string') {
      const match = statusClass.match(/^([1-5])(?:xx)?$/i)
      return match ? Number(match[1]) : null
    }

    return null
  }
}
