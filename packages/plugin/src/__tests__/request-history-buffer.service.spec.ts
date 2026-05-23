import { RequestHistoryEntry } from '../contracts/mcp-api.contract'
import { RequestHistoryBufferService } from '../request-history-buffer.service'

describe('RequestHistoryBufferService', () => {
  const makeEntry = (
    overrides: Partial<RequestHistoryEntry> = {},
  ): Omit<RequestHistoryEntry, 'timestamp'> & {
    timestamp?: number
  } => ({
    timestamp: 1000,
    method: 'GET',
    path: '/users',
    routePattern: '/users',
    statusCode: 200,
    durationMs: 10,
    controllerName: 'UsersController',
    handlerName: 'findAll',
    ip: '127.0.0.1',
    userAgent: 'jest',
    requestSize: null,
    responseSize: null,
    error: null,
    ...overrides,
  })

  it('uses requestHistorySize as circular buffer capacity', () => {
    const service = new RequestHistoryBufferService({ requestHistorySize: 3 } as any)

    service.add(makeEntry({ path: '/one', timestamp: 1 }))
    service.add(makeEntry({ path: '/two', timestamp: 2 }))
    service.add(makeEntry({ path: '/three', timestamp: 3 }))
    service.add(makeEntry({ path: '/four', timestamp: 4 }))

    const entries = service.get(10)
    expect(entries).toHaveLength(3)
    expect(entries.map((entry) => entry.path)).toEqual(['/two', '/three', '/four'])
    expect(service.getStats()).toEqual({ total: 3, bufferSize: 3, capturedSince: new Date(2).toISOString() })
  })

  it('defaults capacity to 100', () => {
    const service = new RequestHistoryBufferService({} as any)

    expect(service.getStats().bufferSize).toBe(100)
  })

  it('filters by method, status, path, duration, and errors', () => {
    const service = new RequestHistoryBufferService({ requestHistorySize: 10 } as any)

    service.add(makeEntry({ method: 'GET', path: '/users', statusCode: 200, durationMs: 20 }))
    service.add(makeEntry({ method: 'POST', path: '/users', statusCode: 201, durationMs: 80 }))
    service.add(
      makeEntry({
        method: 'GET',
        path: '/orders/slow',
        statusCode: 500,
        durationMs: 250,
        error: { name: 'Error', message: 'boom', stack: null },
      }),
    )

    expect(service.filter({ method: 'post' }).map((entry) => entry.statusCode)).toEqual([201])
    expect(service.filter({ statusCode: 500 }).map((entry) => entry.path)).toEqual(['/orders/slow'])
    expect(service.filter({ statusClass: '2xx' })).toHaveLength(2)
    expect(service.filter({ pathContains: 'slow', minDurationMs: 200 })).toHaveLength(1)
    expect(service.filter({ onlyErrors: true }).map((entry) => entry.statusCode)).toEqual([500])
  })

  it('filters by requestId', () => {
    const service = new RequestHistoryBufferService({ requestHistorySize: 10 } as any)

    service.add(makeEntry({ path: '/req1', requestId: 'req-1' }))
    service.add(makeEntry({ path: '/req2', requestId: 'req-2' }))
    service.add(makeEntry({ path: '/req3', requestId: null }))

    expect(service.filter({ requestId: 'req-1' }).map((entry) => entry.path)).toEqual(['/req1'])
    expect(service.filter({ requestId: null }).map((entry) => entry.path)).toEqual(['/req3'])
  })

  it('returns newest entries when limit is provided', () => {
    const service = new RequestHistoryBufferService({ requestHistorySize: 5 } as any)

    service.add(makeEntry({ path: '/one' }))
    service.add(makeEntry({ path: '/two' }))
    service.add(makeEntry({ path: '/three' }))

    expect(service.filter({ limit: 2 }).map((entry) => entry.path)).toEqual(['/two', '/three'])
  })
})
