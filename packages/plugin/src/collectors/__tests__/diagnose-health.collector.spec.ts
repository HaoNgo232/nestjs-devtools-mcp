import { DiagnoseHealthCollector } from '../diagnose-health.collector'
import { RouteCollector } from '../route.collector'
import { ErrorCollector } from '../error.collector'
import { LogBufferService } from '../../log-buffer.service'
import { RequestHistoryBufferService } from '../../request-history-buffer.service'
import { ErrorBufferService } from '../../error-buffer.service'

describe('DiagnoseHealthCollector', () => {
  let collector: DiagnoseHealthCollector
  let logBuffer: LogBufferService
  let historyBuffer: RequestHistoryBufferService
  let errorBuffer: ErrorBufferService
  let routeCollector: RouteCollector
  let errorCollector: ErrorCollector

  beforeEach(() => {
    logBuffer = new LogBufferService({} as any)
    historyBuffer = new RequestHistoryBufferService({} as any)
    errorBuffer = new ErrorBufferService({} as any)
    routeCollector = {
      execute: jest.fn().mockResolvedValue({
        toolName: 'get_routes',
        data: { routes: [{ method: 'GET', path: '/hello' }] },
      }),
    } as any
    errorCollector = {
      execute: jest.fn().mockResolvedValue({
        toolName: 'get_errors',
        data: {
          entries: [
            {
              source: 'http-5xx',
              name: 'Error',
              message: 'Crash 500',
              stack: 'Error at line 1',
              context: 'TestController',
              requestId: 'req-2',
              timestamp: Date.now(),
            },
          ],
          total: 1,
          unhandledCount: 0,
        },
      }),
    } as any

    logBuffer.add({ level: 'log', message: 'req log', requestId: 'req-1' })
    historyBuffer.add({ method: 'GET', path: '/hello', statusCode: 200, durationMs: 15, requestId: 'req-1' })
    historyBuffer.add({ method: 'POST', path: '/error', statusCode: 500, durationMs: 50, requestId: 'req-2' })

    collector = new DiagnoseHealthCollector(
      { name: 'test-app' } as any,
      routeCollector,
      errorCollector,
      logBuffer,
      historyBuffer,
      errorBuffer,
    )
  })

  it('should aggregate health metrics and correlate logs by requestId', async () => {
    const result = await collector.execute({})
    expect(result.toolName).toBe('diagnose_health')

    const data = result.data
    expect(data.server.name).toBe('test-app')
    expect(data.server.pid).toBe(process.pid)
    expect(data.routes.total).toBe(1)
    expect(data.traffic.sampleSize).toBe(2)
    expect(data.traffic.distribution['2xx']).toBe(1)
    expect(data.traffic.distribution['5xx']).toBe(1)
    expect(data.traffic.slowestRequest?.path).toBe('/error')

    expect(data.errors.recent.length).toBe(1)
    expect(data.errors.recent[0].message).toBe('Crash 500')
  })
})
