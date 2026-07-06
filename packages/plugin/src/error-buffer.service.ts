import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options'
import { ErrorSource, McpErrorEntry } from './contracts/mcp-api.contract'

export interface ErrorBufferAddInput {
  source: ErrorSource
  name: string
  message: string
  stack: string | null
  context: string | null
  requestId: string | null
  relatedLogTimestamp: number | null
  timestamp?: number
}

export interface ErrorBufferFilters {
  limit?: number
  source?: ErrorSource
  since?: number
  requestId?: string | null
  onlyUnhandled?: boolean
}

@Injectable()
export class ErrorBufferService {
  private readonly buffer: McpErrorEntry[] = []
  private readonly maxSize: number

  constructor(
    @Inject(DEVTOOLS_OPTIONS_TOKEN)
    options: DevtoolsMcpOptions,
  ) {
    this.maxSize = options?.errorBufferSize || 100
  }

  add(input: ErrorBufferAddInput): McpErrorEntry {
    const entry: McpErrorEntry = {
      id: randomUUID(),
      timestamp: input.timestamp ?? Date.now(),
      source: input.source,
      name: input.name,
      message: input.message,
      stack: input.stack,
      context: input.context,
      requestId: input.requestId,
      relatedLogTimestamp: input.relatedLogTimestamp,
    }
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift()
    }
    this.buffer.push(entry)
    return entry
  }

  get(limit = 50): McpErrorEntry[] {
    return this.buffer.slice(-this.normalizeLimit(limit))
  }

  filter(filters: ErrorBufferFilters = {}): McpErrorEntry[] {
    let entries = this.buffer
    if (filters.source) {
      entries = entries.filter((e) => e.source === filters.source)
    }
    if (typeof filters.since === 'number') {
      const since = filters.since
      entries = entries.filter((e) => e.timestamp >= since)
    }
    if (filters.requestId !== undefined) {
      entries = entries.filter((e) => e.requestId === filters.requestId)
    }
    if (filters.onlyUnhandled === true) {
      entries = entries.filter((e) => e.source === 'unhandled' || e.source === 'bootstrap')
    }
    const limit = filters.limit ?? 200
    return entries.slice(-this.normalizeLimit(limit))
  }

  count(filters: Omit<ErrorBufferFilters, 'limit'> = {}): number {
    return this.filter({ ...filters, limit: this.maxSize }).length
  }

  getStats() {
    return {
      total: this.buffer.length,
      bufferSize: this.maxSize,
      unhandledCount: this.buffer.filter((e) => e.source === 'unhandled').length,
      capturedSince: this.buffer[0] ? new Date(this.buffer[0].timestamp).toISOString() : null,
    }
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit <= 0) return 50
    return Math.min(Math.floor(limit), 200)
  }
}
