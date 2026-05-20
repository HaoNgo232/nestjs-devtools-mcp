import { Injectable } from '@nestjs/common'
import { RequestHistoryEntry } from '../contracts/mcp-api.contract'
import { RequestHistoryBufferService, RequestHistoryFilters } from '../request-history-buffer.service'
import { CollectorResult, DevtoolsCollector } from './collector.interface'

export interface RequestHistoryCollectorResponse {
  entries: RequestHistoryEntry[]
  total: number
  bufferSize: number
  capturedSince: string | null
}

@Injectable()
export class RequestHistoryCollector implements DevtoolsCollector<RequestHistoryCollectorResponse> {
  readonly toolName = 'get_request_history'
  readonly description = 'Retrieve recent HTTP request/response history with timing, status, and error details.'

  constructor(private readonly requestHistoryBuffer: RequestHistoryBufferService) {}

  async execute(params: Record<string, unknown>): Promise<CollectorResult<RequestHistoryCollectorResponse>> {
    const filters = this.normalizeFilters(params)
    const entries = this.requestHistoryBuffer.filter(filters)
    const stats = this.requestHistoryBuffer.getStats()
    const total = this.requestHistoryBuffer.count(this.withoutLimit(filters))

    return {
      toolName: this.toolName,
      data: {
        entries,
        total,
        bufferSize: stats.bufferSize,
        capturedSince: stats.capturedSince,
      },
    }
  }

  private normalizeFilters(params: Record<string, unknown>): RequestHistoryFilters {
    return {
      limit: this.normalizeLimit(params.limit),
      method: typeof params.method === 'string' ? params.method : undefined,
      statusCode: typeof params.statusCode === 'number' ? params.statusCode : undefined,
      statusClass:
        typeof params.statusClass === 'number' || typeof params.statusClass === 'string' ? params.statusClass : undefined,
      pathContains: typeof params.pathContains === 'string' ? params.pathContains : undefined,
      minDurationMs: typeof params.minDurationMs === 'number' ? params.minDurationMs : undefined,
      onlyErrors: params.onlyErrors === true,
    }
  }

  private normalizeLimit(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return 50
    }

    return Math.min(Math.floor(value), 200)
  }

  private withoutLimit(filters: RequestHistoryFilters): Omit<RequestHistoryFilters, 'limit'> {
    const { limit: _limit, ...rest } = filters
    return rest
  }
}
