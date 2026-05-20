import { RequestHistoryCollector } from '../request-history.collector'
import { RequestHistoryEntry } from '../../contracts/mcp-api.contract'
import { RequestHistoryBufferService } from '../../request-history-buffer.service'

describe('RequestHistoryCollector', () => {
  let collector: RequestHistoryCollector
  let mockBuffer: jest.Mocked<Pick<RequestHistoryBufferService, 'filter' | 'count' | 'getStats'>>

  const entries: RequestHistoryEntry[] = [
    {
      timestamp: 1000,
      method: 'GET',
      path: '/users',
      routePattern: '/users',
      statusCode: 200,
      durationMs: 12,
      controllerName: 'UsersController',
      handlerName: 'findAll',
      ip: '127.0.0.1',
      userAgent: 'jest',
      requestSize: null,
      responseSize: null,
      error: null,
    },
  ]

  beforeEach(() => {
    mockBuffer = {
      filter: jest.fn().mockReturnValue(entries),
      count: jest.fn().mockReturnValue(1),
      getStats: jest.fn().mockReturnValue({ total: 3, bufferSize: 100, capturedSince: '1970-01-01T00:00:01.000Z' }),
    }

    collector = new RequestHistoryCollector(mockBuffer as unknown as RequestHistoryBufferService)
  })

  it('exposes get_request_history identity', () => {
    expect(collector.toolName).toBe('get_request_history')
    expect(collector.description).toBe(
      'Retrieve recent HTTP request/response history with timing, status, and error details.',
    )
  })

  it('uses default limit=50 when params are empty', async () => {
    await collector.execute({})

    expect(mockBuffer.filter).toHaveBeenCalledWith({
      limit: 50,
      method: undefined,
      statusCode: undefined,
      statusClass: undefined,
      pathContains: undefined,
      minDurationMs: undefined,
      onlyErrors: false,
    })
  })

  it('caps limit at 200 and forwards filters', async () => {
    await collector.execute({
      limit: 999,
      method: 'POST',
      statusCode: 500,
      statusClass: '5xx',
      pathContains: '/users',
      minDurationMs: 100,
      onlyErrors: true,
    })

    expect(mockBuffer.filter).toHaveBeenCalledWith({
      limit: 200,
      method: 'POST',
      statusCode: 500,
      statusClass: '5xx',
      pathContains: '/users',
      minDurationMs: 100,
      onlyErrors: true,
    })
    expect(mockBuffer.count).toHaveBeenCalledWith({
      method: 'POST',
      statusCode: 500,
      statusClass: '5xx',
      pathContains: '/users',
      minDurationMs: 100,
      onlyErrors: true,
    })
  })

  it('returns collector response shape', async () => {
    const result = await collector.execute({})

    expect(result).toEqual({
      toolName: 'get_request_history',
      data: {
        entries,
        total: 1,
        bufferSize: 100,
        capturedSince: '1970-01-01T00:00:01.000Z',
      },
    })
  })
})
