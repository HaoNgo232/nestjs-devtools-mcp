import { Injectable, Inject } from '@nestjs/common'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options'

export interface LogEntry {
  timestamp: number
  level: 'log' | 'error' | 'warn' | 'debug' | 'verbose'
  message: string
  context?: string
  trace?: string
}

@Injectable()
export class LogBufferService {
  private readonly buffer: LogEntry[] = []
  private readonly maxSize: number

  constructor(
    @Inject(DEVTOOLS_OPTIONS_TOKEN)
    private readonly options: DevtoolsMcpOptions,
  ) {
    this.maxSize = options.logBufferSize || 500
  }

  /**
   * Add a new log to the circular buffer
   * @param entry Log object containing level, message, context and trace information
   */
  add(entry: Omit<LogEntry, 'timestamp'>) {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: Date.now(),
    }

    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift() // Remove the oldest element if buffer is full
    }
    this.buffer.push(logEntry)
  }

  /**
   * Get logs from the buffer based on filtering criteria
   * @param lines Maximum number of log lines to retrieve
   * @param level Filter by log level
   * @returns List of log entries
   */
  getLogs(lines = 50, level: string = 'all'): LogEntry[] {
    let filtered = this.buffer
    if (level !== 'all') {
      filtered = this.buffer.filter((e) => e.level === level)
    }
    return filtered.slice(-lines)
  }

  /**
   * Returns metadata about the buffer status
   */
  getStats() {
    return {
      total: this.buffer.length,
      bufferSize: this.maxSize,
    }
  }
}
