import { ErrorCollector } from '../error.collector'
import { ErrorBufferService } from '../../error-buffer.service'
import { LogBufferService } from '../../log-buffer.service'
import { RequestHistoryBufferService } from '../../request-history-buffer.service'
import { ErrorSource } from '../../contracts/mcp-api.contract'

describe('ErrorCollector', () => {
  let collector: ErrorCollector
  let mockErrorBuffer: jest.Mocked<Pick<ErrorBufferService, 'filter' | 'count' | 'getStats'>>
  let mockLogBuffer: jest.Mocked<Pick<LogBufferService, 'getLogs' | 'getStats'>>
  let mockRequestHistoryBuffer: jest.Mocked<Pick<RequestHistoryBufferService, 'filter' | 'count' | 'getStats'>>

  beforeEach(() => {
    mockErrorBuffer = {
      filter: jest.fn().mockReturnValue([]),
      count: jest.fn().mockReturnValue(0),
      getStats: jest.fn().mockReturnValue({
        total: 0,
        bufferSize: 100,
        unhandledCount: 0,
        capturedSince: null,
      }),
    }
    mockLogBuffer = {
      getLogs: jest.fn().mockReturnValue([]),
      getStats: jest.fn().mockReturnValue({ total: 0, bufferSize: 500 }),
    }
    mockRequestHistoryBuffer = {
      filter: jest.fn().mockReturnValue([]),
      count: jest.fn().mockReturnValue(0),
      getStats: jest.fn().mockReturnValue({ total: 0, bufferSize: 100, capturedSince: null }),
    }

    collector = new ErrorCollector(
      mockErrorBuffer as unknown as ErrorBufferService,
      mockLogBuffer as unknown as LogBufferService,
      mockRequestHistoryBuffer as unknown as RequestHistoryBufferService,
      { includeStackInProduction: false },
    )
  })

  // ── Identity ──────────────────────────────────────────────

  it('exposes toolName as "get_errors"', () => {
    expect(collector.toolName).toBe('get_errors')
  })

  it('exposes a non-empty description', () => {
    expect(collector.description).toMatch(/error/i)
  })

  // ── Default params ────────────────────────────────────────

  it('uses default limit=50, no source filter, onlyUnhandled=false', async () => {
    await collector.execute({})

    expect(mockErrorBuffer.filter).toHaveBeenCalledWith({
      limit: 50,
      source: undefined,
      since: undefined,
      requestId: undefined,
      onlyUnhandled: false,
    })
  })

  // ── Forwarding filters ────────────────────────────────────

  it('forwards source filter to ErrorBufferService', async () => {
    await collector.execute({ source: 'unhandled' })
    expect(mockErrorBuffer.filter).toHaveBeenCalledWith(expect.objectContaining({ source: 'unhandled' }))
  })

  it('forwards since, requestId, onlyUnhandled, limit', async () => {
    await collector.execute({
      limit: 25,
      source: 'runtime' as ErrorSource,
      since: 1234567890,
      requestId: 'req-9',
      onlyUnhandled: true,
    })
    expect(mockErrorBuffer.filter).toHaveBeenCalledWith({
      limit: 25,
      source: 'runtime',
      since: 1234567890,
      requestId: 'req-9',
      onlyUnhandled: true,
    })
  })

  it('caps limit at 200', async () => {
    await collector.execute({ limit: 999 })
    expect(mockErrorBuffer.filter).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }))
  })

  // ── Runtime errors from LogBuffer ─────────────────────────

  it('aggregates runtime errors from LogBuffer when source is "runtime" or undefined', async () => {
    mockLogBuffer.getLogs.mockReturnValue([
      {
        timestamp: 1000,
        level: 'error',
        message: 'runtime boom',
        context: 'App',
        trace: 'stack',
        requestId: 'req-1',
      },
    ] as any)

    const result = await collector.execute({ source: 'runtime' })

    expect(mockLogBuffer.getLogs).toHaveBeenCalledWith(50, 'error')
    expect(result.data.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'runtime',
          message: 'runtime boom',
          requestId: 'req-1',
          relatedLogTimestamp: 1000,
        }),
      ]),
    )
  })

  it('skips LogBuffer aggregation when source is "unhandled" or "bootstrap"', async () => {
    await collector.execute({ source: 'unhandled' })
    expect(mockLogBuffer.getLogs).not.toHaveBeenCalled()

    await collector.execute({ source: 'bootstrap' })
    expect(mockLogBuffer.getLogs).not.toHaveBeenCalled()
  })

  // ── HTTP 5xx from RequestHistoryBuffer ────────────────────

  it('aggregates HTTP 5xx errors from RequestHistoryBuffer when source is "http-5xx" or undefined', async () => {
    mockRequestHistoryBuffer.filter.mockReturnValue([
      {
        timestamp: 2000,
        method: 'GET',
        path: '/users',
        routePattern: '/users',
        statusCode: 500,
        durationMs: 100,
        controllerName: 'UsersController',
        handlerName: 'findAll',
        ip: '127.0.0.1',
        userAgent: 'jest',
        requestSize: null,
        responseSize: null,
        error: { name: 'Error', message: 'db down', stack: 'st' },
        requestId: 'req-2',
      },
    ] as any)

    const result = await collector.execute({ source: 'http-5xx' })

    expect(mockRequestHistoryBuffer.filter).toHaveBeenCalledWith(expect.objectContaining({ onlyErrors: true }))
    expect(result.data.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'http-5xx',
          message: 'db down',
          requestId: 'req-2',
        }),
      ]),
    )
  })

  it('filters HTTP entries to statusCode >= 500 only', async () => {
    mockRequestHistoryBuffer.filter.mockReturnValue([
      {
        timestamp: 3000,
        statusCode: 404,
        method: 'GET',
        path: '/x',
        routePattern: null,
        durationMs: 5,
        controllerName: null,
        handlerName: null,
        ip: '',
        userAgent: null,
        requestSize: null,
        responseSize: null,
        error: null,
        requestId: null,
      },
    ] as any)

    const result = await collector.execute({ source: 'http-5xx' })
    // 404 should be filtered out
    expect(result.data.entries.find((e) => e.source === 'http-5xx')).toBeUndefined()
  })

  // ── Stack masking in production ───────────────────────────

  it('masks stack when includeStack=false (production default)', async () => {
    mockErrorBuffer.filter.mockReturnValue([
      {
        id: 'id1',
        timestamp: 1,
        source: 'unhandled',
        name: 'Error',
        message: 'm',
        stack: 'secret-stack',
        context: null,
        requestId: null,
        relatedLogTimestamp: null,
      },
    ] as any)

    const result = await collector.execute({ includeStack: false })
    expect(result.data.entries[0].stack).toBeNull()
  })

  it('preserves stack when includeStack=true and not production', async () => {
    mockErrorBuffer.filter.mockReturnValue([
      {
        id: 'id1',
        timestamp: 1,
        source: 'unhandled',
        name: 'Error',
        message: 'm',
        stack: 'secret-stack',
        context: null,
        requestId: null,
        relatedLogTimestamp: null,
      },
    ] as any)

    const result = await collector.execute({ includeStack: true })
    expect(result.data.entries[0].stack).toBe('secret-stack')
  })

  it('forces stack=null in production regardless of includeStack param', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    mockErrorBuffer.filter.mockReturnValue([
      {
        id: 'id1',
        timestamp: 1,
        source: 'unhandled',
        name: 'Error',
        message: 'm',
        stack: 'secret-stack',
        context: null,
        requestId: null,
        relatedLogTimestamp: null,
      },
    ] as any)

    const result = await collector.execute({ includeStack: true })
    expect(result.data.entries[0].stack).toBeNull()

    process.env.NODE_ENV = originalEnv
  })

  // ── Response shape ────────────────────────────────────────

  it('returns CollectorResult with toolName "get_errors"', async () => {
    const result = await collector.execute({})
    expect(result.toolName).toBe('get_errors')
  })

  it('merges entries from all sources, sorts by timestamp desc, dedupes by id', async () => {
    mockErrorBuffer.filter.mockReturnValue([
      {
        id: 'e1',
        timestamp: 1000,
        source: 'unhandled',
        name: 'E',
        message: 'm1',
        stack: null,
        context: null,
        requestId: null,
        relatedLogTimestamp: null,
      },
    ] as any)
    mockLogBuffer.getLogs.mockReturnValue([
      { timestamp: 2000, level: 'error', message: 'm2', context: 'C', trace: null, requestId: null },
    ] as any)
    mockRequestHistoryBuffer.filter.mockReturnValue([
      {
        timestamp: 500,
        statusCode: 500,
        error: { name: 'E', message: 'm3', stack: null },
        method: 'GET',
        path: '/x',
        routePattern: null,
        durationMs: 1,
        controllerName: null,
        handlerName: null,
        ip: '',
        userAgent: null,
        requestSize: null,
        responseSize: null,
        requestId: null,
      },
    ] as any)

    const result = await collector.execute({}) // source undefined → aggregate all
    const timestamps = result.data.entries.map((e) => e.timestamp)
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a)) // desc
    expect(result.data.entries.length).toBe(3)
  })

  it('reports total = count of all matching errors (capped at 200 returned)', async () => {
    mockErrorBuffer.count.mockReturnValue(250)
    const result = await collector.execute({})
    expect(result.data.total).toBe(250)
  })

  it('reports unhandledCount from ErrorBufferService stats', async () => {
    mockErrorBuffer.getStats.mockReturnValue({
      total: 10,
      bufferSize: 100,
      unhandledCount: 3,
      capturedSince: '2026-01-01T00:00:00.000Z',
    })
    const result = await collector.execute({})
    expect(result.data.unhandledCount).toBe(3)
    expect(result.data.capturedSince).toBe('2026-01-01T00:00:00.000Z')
  })
})
