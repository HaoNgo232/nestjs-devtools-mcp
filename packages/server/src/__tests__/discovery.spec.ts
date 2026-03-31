import { discoverServers, NestServerInfo } from '../discovery'

/**
 * Mock global.fetch cho toàn bộ test suite.
 * Mỗi test case sẽ cấu hình behavior riêng qua mockImplementation.
 */
const mockFetch = jest.fn()
global.fetch = mockFetch as any

beforeEach(() => {
  mockFetch.mockReset()
})

// ─────────────────────────────────────────────────────
// Helper: tạo mock Response object
// ─────────────────────────────────────────────────────
function mockJsonResponse(data: Record<string, unknown>, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

function mockHealthPayload(port: number, overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok',
    name: 'nestjs-devtools-mcp',
    pid: 12345,
    version: '0.1.0',
    uptime: 42,
    tools: ['get_logs'],
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────
// HAPPY PATH
// ─────────────────────────────────────────────────────
describe('discoverServers', () => {
  it('should return empty array when no servers respond', async () => {
    // Arrange: mọi fetch đều reject (connection refused)
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    // Act
    const result = await discoverServers()

    // Assert
    expect(result).toEqual([])
  })

  it('should find a single server on default port range', async () => {
    // Arrange: chỉ port 3000 trả health hợp lệ
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'http://localhost:3000/_dev/mcp/health') {
        return mockJsonResponse(mockHealthPayload(3000))
      }
      throw new Error('ECONNREFUSED')
    })

    // Act
    const result = await discoverServers()

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      port: 3000,
      pid: 12345,
      name: 'nestjs-devtools-mcp',
    })
    expect(result[0].healthUrl).toBe('http://localhost:3000/_dev/mcp/health')
  })

  it('should find multiple servers across different ports', async () => {
    // Arrange: port 3000 và 3005 đều có plugin
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'http://localhost:3000/_dev/mcp/health') {
        return mockJsonResponse(mockHealthPayload(3000, { pid: 1000 }))
      }
      if (url === 'http://localhost:3005/_dev/mcp/health') {
        return mockJsonResponse(mockHealthPayload(3005, { pid: 2000 }))
      }
      throw new Error('ECONNREFUSED')
    })

    // Act
    const result = await discoverServers()

    // Assert
    expect(result).toHaveLength(2)
    const ports = result.map((s) => s.port).sort()
    expect(ports).toEqual([3000, 3005])
  })

  it('should respect custom port range', async () => {
    // Arrange: server on port 8080 — ngoài range mặc định nhưng trong custom range
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'http://localhost:8080/_dev/mcp/health') {
        return mockJsonResponse(mockHealthPayload(8080))
      }
      throw new Error('ECONNREFUSED')
    })

    // Act
    const result = await discoverServers(8079, 8081)

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].port).toBe(8080)
  })

  // ─────────────────────────────────────────────────────
  // FILTERING
  // ─────────────────────────────────────────────────────
  it('should filter out servers that do not have matching name', async () => {
    // Arrange: server trả response nhưng name khác → không phải DevTools plugin
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'http://localhost:3000/_dev/mcp/health') {
        return mockJsonResponse({ status: 'ok', name: 'some-other-service', pid: 999 })
      }
      throw new Error('ECONNREFUSED')
    })

    // Act
    const result = await discoverServers()

    // Assert
    expect(result).toEqual([])
  })

  it('should filter out servers returning non-ok HTTP status', async () => {
    // Arrange: server trả 500
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'http://localhost:3000/_dev/mcp/health') {
        return mockJsonResponse({ error: 'Internal Server Error' }, false, 500)
      }
      throw new Error('ECONNREFUSED')
    })

    // Act
    const result = await discoverServers()

    // Assert
    expect(result).toEqual([])
  })

  // ─────────────────────────────────────────────────────
  // ERROR RESILIENCE
  // ─────────────────────────────────────────────────────
  it('should handle fetch abort (timeout) gracefully', async () => {
    // Arrange: fetch bị abort do timeout
    mockFetch.mockImplementation(async () => {
      const error = new DOMException('The operation was aborted', 'AbortError')
      throw error
    })

    // Act
    const result = await discoverServers()

    // Assert: không crash, trả empty
    expect(result).toEqual([])
  })

  it('should handle generic fetch error gracefully', async () => {
    // Arrange: fetch bị lỗi chung (ví dụ DNS fail)
    mockFetch.mockRejectedValue(new Error('Generic failure'))

    // Act
    const result = await discoverServers()

    // Assert: không crash, trả empty (covers catch block)
    expect(result).toEqual([])
  })

  it('should handle mixed success and failure across ports', async () => {
    // Arrange: port 3000 thành công, 3001 timeout, 3002 wrong name, 3003 HTTP 500
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'http://localhost:3000/_dev/mcp/health') {
        return mockJsonResponse(mockHealthPayload(3000))
      }
      if (url === 'http://localhost:3001/_dev/mcp/health') {
        throw new DOMException('Aborted', 'AbortError')
      }
      if (url === 'http://localhost:3002/_dev/mcp/health') {
        return mockJsonResponse({ status: 'ok', name: 'wrong-name' })
      }
      if (url === 'http://localhost:3003/_dev/mcp/health') {
        return mockJsonResponse({ error: 'fail' }, false, 500)
      }
      throw new Error('ECONNREFUSED')
    })

    // Act
    const result = await discoverServers()

    // Assert: chỉ port 3000 hợp lệ
    expect(result).toHaveLength(1)
    expect(result[0].port).toBe(3000)
  })

  it('should call fetch with AbortController signal', async () => {
    // Arrange
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    // Act
    await discoverServers(3000, 3000) // chỉ scan 1 port cho đơn giản

    // Assert: fetch được gọi với signal
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toBe('http://localhost:3000/_dev/mcp/health')
    expect(callArgs[1]).toHaveProperty('signal')
  })
})
