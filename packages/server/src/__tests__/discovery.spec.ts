import { discoverServers, NestServerInfo } from '../discovery'

/**
 * Mock global.fetch cho toàn bộ test suite.
 * Mỗi test case sẽ cấu hình behavior riêng qua mockImplementation.
 */
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Mock execSync để cô lập getListenPorts
const mockExecSync = jest.fn()
jest.mock('child_process', () => ({
  execSync: (cmd: string) => mockExecSync(cmd),
}))

beforeEach(() => {
  mockFetch.mockReset()
  mockExecSync.mockReset()
  mockExecSync.mockReturnValue('') // Mặc định không có port nào đang listen
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
    mockExecSync.mockReturnValue('') // Không có listen port từ hệ thống

    // Act
    await discoverServers(3000, 3000) // chỉ scan 1 port (3000)

    /**
     * Assert: Với logic rút gọn Discovery chỉ thử 1 prefix cho mỗi port.
     */
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toBe('http://localhost:3000/_dev/mcp/health')
    expect(callArgs[1]).toHaveProperty('signal')
  })

  describe('discoverServers — single prefix scan', () => {
    it('should only probe root prefix by default (no /api, /v1)', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
      mockExecSync.mockReturnValue('')

      await discoverServers(3000, 3000)

      // Only 1 fetch per port (was 3 with multi-prefix)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/_dev/mcp/health', expect.anything())
    })

    it('respects NESTJS_MCP_PREFIX env var when set', async () => {
      process.env.NESTJS_MCP_PREFIX = '/api'
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
      mockExecSync.mockReturnValue('')

      await discoverServers(3000, 3000)

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/_dev/mcp/health', expect.anything())
      delete process.env.NESTJS_MCP_PREFIX
    })

    it('normalizes prefix without trailing slash', async () => {
      process.env.NESTJS_MCP_PREFIX = 'api/'
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
      mockExecSync.mockReturnValue('')

      await discoverServers(3000, 3000)

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/_dev/mcp/health', expect.anything())
      delete process.env.NESTJS_MCP_PREFIX
    })
  })

  // ─────────────────────────────────────────────────────
  // PLATFORM & ERROR FALLBACKS (getListenPorts)
  // ─────────────────────────────────────────────────────

  describe('getListenPorts (Platform & Error Coverage)', () => {
    let originalPlatform: string

    beforeAll(() => {
      originalPlatform = process.platform
    })

    afterAll(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    const setPlatform = (platform: string) => {
      Object.defineProperty(process, 'platform', { value: platform, configurable: true })
    }

    it('should use netstat on Windows', async () => {
      setPlatform('win32')
      mockExecSync.mockReturnValue('3000\n3001')

      const result = await discoverServers(3000, 3000)
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('netstat'))
    })

    it('should return empty range when command execution fails', async () => {
      setPlatform('linux')
      mockExecSync.mockImplementation(() => {
        throw new Error('command failed')
      })

      // Act: discoverServers still works because range scan is the fallback
      const result = await discoverServers(3000, 3000)
      // Check that fetch was still called for port 3000 from the range scan
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(':3000'), expect.anything())
    })

    it('should return empty list when platform is unknown and no command exists', async () => {
      setPlatform('unknown-os' as any)
      // Discovery should proceed with range scan only
      await discoverServers(3000, 3000)
      expect(mockExecSync).not.toHaveBeenCalled()
    })
  })
})
