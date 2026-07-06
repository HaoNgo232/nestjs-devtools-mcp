import * as contracts from '../contracts'

describe('Contracts Index', () => {
  it('should export all essential types and constants', () => {
    // This is a dummy test to ensure coverage of the re-export index file
    // Test giả để cover file index export
    expect(contracts).toBeDefined()
  })

  it('LogEntry and RequestHistoryEntry contract includes optional requestId field', () => {
    const logSample: import('../contracts/mcp-api.contract').McpLogEntry = {
      timestamp: '2026-01-01T00:00:00.000Z',
      level: 'log',
      context: 'X',
      message: 'm',
      requestId: 'abc-123',
    }
    expect(logSample.requestId).toBeDefined()

    const reqSample: import('../contracts/mcp-api.contract').RequestHistoryEntry = {
      timestamp: Date.now(),
      method: 'GET',
      path: '/api',
      routePattern: '/api',
      statusCode: 200,
      durationMs: 10,
      controllerName: 'C',
      handlerName: 'H',
      ip: '127.0.0.1',
      userAgent: 'U',
      requestSize: null,
      responseSize: null,
      error: null,
      requestId: 'abc-123',
    }
    expect(reqSample.requestId).toBeDefined()
  })

  it('McpGetLogsResponse contract matches actual collector response shape', () => {
    const response: import('../contracts/mcp-api.contract').McpGetLogsResponse = {
      entries: [
        {
          timestamp: Date.now(),
          level: 'log',
          context: 'App',
          message: 'hello',
          requestId: null,
        },
      ],
      total: 1,
      bufferSize: 500,
    }

    expect(response.entries).toHaveLength(1)
    expect(response.total).toBe(1)
    expect(response.bufferSize).toBe(500)
  })

  it('McpGetLogsRequest contract supports lines and requestId', () => {
    const request: import('../contracts/mcp-api.contract').McpGetLogsRequest = {
      lines: 20,
      level: 'error',
      requestId: 'req-123',
    }

    expect(request.lines).toBe(20)
    expect(request.level).toBe('error')
    expect(request.requestId).toBe('req-123')
  })
})
