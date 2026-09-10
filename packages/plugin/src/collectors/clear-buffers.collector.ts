import { Injectable } from '@nestjs/common'
import { DevtoolsCollector, CollectorResult } from './collector.interface'
import { LogBufferService } from '../log-buffer.service'
import { RequestHistoryBufferService } from '../request-history-buffer.service'
import { ErrorBufferService } from '../error-buffer.service'

export interface ClearBuffersResultData {
  target: 'all' | 'logs' | 'history' | 'errors'
  cleared: {
    logs: number
    history: number
    errors: number
  }
  totalCleared: number
}

@Injectable()
export class ClearBuffersCollector implements DevtoolsCollector<ClearBuffersResultData> {
  readonly toolName = 'clear_buffers'
  readonly description = 'Clear in-memory telemetry buffers (logs, request history, errors)'

  constructor(
    private readonly logBuffer: LogBufferService,
    private readonly requestHistoryBuffer: RequestHistoryBufferService,
    private readonly errorBuffer: ErrorBufferService,
  ) {}

  execute(params: Record<string, unknown>): CollectorResult<ClearBuffersResultData> {
    const target = (typeof params.target === 'string' ? params.target.toLowerCase() : 'all') as
      'all' | 'logs' | 'history' | 'errors'

    const cleared = {
      logs: 0,
      history: 0,
      errors: 0,
    }

    if (target === 'all' || target === 'logs') {
      cleared.logs = this.logBuffer.clear()
    }
    if (target === 'all' || target === 'history') {
      cleared.history = this.requestHistoryBuffer.clear()
    }
    if (target === 'all' || target === 'errors') {
      cleared.errors = this.errorBuffer.clear()
    }

    const totalCleared = cleared.logs + cleared.history + cleared.errors

    return {
      toolName: this.toolName,
      data: {
        target,
        cleared,
        totalCleared,
      },
    }
  }
}
