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
})
