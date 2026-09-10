import { ClearBuffersCollector } from '../clear-buffers.collector'
import { LogBufferService } from '../../log-buffer.service'
import { RequestHistoryBufferService } from '../../request-history-buffer.service'
import { ErrorBufferService } from '../../error-buffer.service'

describe('ClearBuffersCollector', () => {
  let collector: ClearBuffersCollector
  let logBuffer: LogBufferService
  let historyBuffer: RequestHistoryBufferService
  let errorBuffer: ErrorBufferService

  beforeEach(() => {
    logBuffer = new LogBufferService({} as any)
    historyBuffer = new RequestHistoryBufferService({} as any)
    errorBuffer = new ErrorBufferService({} as any)

    // Seed dummy data
    logBuffer.add({ level: 'log', message: 'test log' })
    historyBuffer.add({ method: 'GET', path: '/test', statusCode: 200, durationMs: 10 })
    errorBuffer.add({
      source: 'runtime',
      name: 'Error',
      message: 'test error',
      stack: null,
      context: null,
      requestId: null,
      relatedLogTimestamp: null,
    })

    collector = new ClearBuffersCollector(logBuffer, historyBuffer, errorBuffer)
  })

  it('should have correct toolName and description', () => {
    expect(collector.toolName).toBe('clear_buffers')
    expect(collector.description).toBeTruthy()
  })

  it('should clear all buffers by default', () => {
    const result = collector.execute({})
    expect(result.toolName).toBe('clear_buffers')
    expect(result.data.target).toBe('all')
    expect(result.data.cleared.logs).toBe(1)
    expect(result.data.cleared.history).toBe(1)
    expect(result.data.cleared.errors).toBe(1)
    expect(result.data.totalCleared).toBe(3)

    expect(logBuffer.getLogs().length).toBe(0)
    expect(historyBuffer.get().length).toBe(0)
    expect(errorBuffer.get().length).toBe(0)
  })

  it('should clear only logs when target is logs', () => {
    const result = collector.execute({ target: 'logs' })
    expect(result.data.target).toBe('logs')
    expect(result.data.cleared.logs).toBe(1)
    expect(result.data.cleared.history).toBe(0)
    expect(result.data.cleared.errors).toBe(0)

    expect(logBuffer.getLogs().length).toBe(0)
    expect(historyBuffer.get().length).toBe(1)
    expect(errorBuffer.get().length).toBe(1)
  })

  it('should clear only errors when target is errors', () => {
    const result = collector.execute({ target: 'errors' })
    expect(result.data.target).toBe('errors')
    expect(result.data.cleared.errors).toBe(1)
    expect(errorBuffer.get().length).toBe(0)
    expect(logBuffer.getLogs().length).toBe(1)
  })
})
