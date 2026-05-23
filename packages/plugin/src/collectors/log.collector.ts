import { Injectable } from '@nestjs/common'
import { LogBufferService, LogEntry } from '../log-buffer.service'
import { DevtoolsCollector, CollectorResult } from './collector.interface'

/**
 * LogCollector implements DevtoolsCollector to handle 'get_logs' tool requests.
 * It encapsulates the logic for retrieving and filtering runtime logs from LogBufferService.
 */
@Injectable()
export class LogCollector implements DevtoolsCollector {
  readonly toolName = 'get_logs'
  readonly description = 'Retrieve recently generated runtime application logs from the buffer.'

  constructor(private readonly logBuffer: LogBufferService) {}

  /**
   * Executes the log collection process based on input parameters.
   * @param params Filtering parameters like 'lines' and 'level'
   */
  async execute(
    params: Record<string, unknown>,
  ): Promise<CollectorResult<{ entries: LogEntry[]; total: number; bufferSize: number }>> {
    // Moved filtering logic from Controller to here
    const lines = typeof params.lines === 'number' ? params.lines : 50
    const level = typeof params.level === 'string' ? params.level : 'all'
    const requestId = typeof params.requestId === 'string' ? params.requestId : undefined

    const entries =
      requestId !== undefined ? this.logBuffer.getLogs(lines, level, requestId) : this.logBuffer.getLogs(lines, level)
    const stats = this.logBuffer.getStats()

    return {
      toolName: this.toolName,
      data: {
        entries,
        ...stats,
      },
    }
  }
}
