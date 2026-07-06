import { DevToolsProxy } from '../proxy'
import * as discoveryModule from '../discovery'

// Mock discovery module
jest.mock('../discovery')
const mockDiscoverServers = discoveryModule.discoverServers as jest.MockedFunction<
  typeof discoveryModule.discoverServers
>

// Mock global.fetch cho callPluginTool
const mockFetch = jest.fn()
global.fetch = mockFetch as any

beforeEach(() => {
  mockDiscoverServers.mockReset()
  mockFetch.mockReset()
})

// ─────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────
function makeServerInfo(port: number): discoveryModule.NestServerInfo {
  return {
    port,
    pid: port * 10,
    name: 'nestjs-devtools-mcp',
    version: '0.1.0',
    uptime: 100,
    healthUrl: `http://localhost:${port}/_dev/mcp/health`,
  }
}

// =============================================================
// resolvePort
// =============================================================
describe('DevToolsProxy.resolvePort', () => {
  it('should return explicit port immediately without scanning', async () => {
    // Arrange
    const proxy = new DevToolsProxy()

    // Act
    const port = await proxy.resolvePort(4000)

    // Assert
    expect(port).toBe(4000)
    expect(mockDiscoverServers).not.toHaveBeenCalled()
  })

  it('should auto-select when exactly one server is discovered', async () => {
    // Arrange
    mockDiscoverServers.mockResolvedValue([makeServerInfo(3000)])
    const proxy = new DevToolsProxy()

    // Act
    const port = await proxy.resolvePort()

    // Assert
    expect(port).toBe(3000)
    expect(mockDiscoverServers).toHaveBeenCalledTimes(1)
  })

  it('should throw descriptive error when multiple servers found', async () => {
    // Arrange
    mockDiscoverServers.mockResolvedValue([makeServerInfo(3000), makeServerInfo(3005)])
    const proxy = new DevToolsProxy()

    // Act & Assert
    await expect(proxy.resolvePort()).rejects.toThrow('Multiple NestJS servers found')
    await expect(proxy.resolvePort()).rejects.toThrow('3000')
    await expect(proxy.resolvePort()).rejects.toThrow('3005')
  })

  it('should throw descriptive error when no server found', async () => {
    // Arrange
    mockDiscoverServers.mockResolvedValue([])
    const proxy = new DevToolsProxy()

    // Act & Assert
    await expect(proxy.resolvePort()).rejects.toThrow('No NestJS server found')
  })

  it('should cache explicit port for subsequent calls', async () => {
    // Arrange
    const proxy = new DevToolsProxy()

    // Act: lần đầu chỉ định port
    const port1 = await proxy.resolvePort(3001)

    // Assert
    expect(port1).toBe(3001)
    // Lưu ý: lastSelectedPort là private, verify qua behavior nếu cần.
    // Hiện tại chỉ test return value đúng.
  })

  it('should re-scan on every call without explicit port', async () => {
    // Arrange: lần 1 có 1 server, lần 2 server đã tắt
    const proxy = new DevToolsProxy()
    mockDiscoverServers.mockResolvedValueOnce([makeServerInfo(3000)])
    mockDiscoverServers.mockResolvedValueOnce([])

    // Act: lần 1 thành công
    const port = await proxy.resolvePort()
    expect(port).toBe(3000)

    // Act: lần 2 không còn server
    await expect(proxy.resolvePort()).rejects.toThrow('No NestJS server found')

    // Assert: discoverServers được gọi 2 lần
    expect(mockDiscoverServers).toHaveBeenCalledTimes(2)
  })
})

// =============================================================
// callPluginTool
// =============================================================
describe('DevToolsProxy.callPluginTool', () => {
  it('should POST to correct URL with JSON body and return parsed response', async () => {
    // Arrange
    const responseData = { entries: [], total: 0, bufferSize: 500 }
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responseData,
    })
    const proxy = new DevToolsProxy()

    // Act
    const result = await proxy.callPluginTool(3000, 'get_logs', { lines: 20, level: 'error' })

    // Assert: đúng URL
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/_dev/mcp/tools/get_logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: 20, level: 'error' }),
    })
    // Assert: đúng data
    expect(result).toEqual(responseData)
  })

  it('should send empty object as body when no payload provided', async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    const proxy = new DevToolsProxy()

    // Act
    await proxy.callPluginTool(3000, 'get_logs')

    // Assert
    const callArgs = mockFetch.mock.calls[0]
    expect(JSON.parse(callArgs[1].body)).toEqual({})
  })

  it('should throw with status and body when HTTP response is not ok', async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Tool not found',
    })
    const proxy = new DevToolsProxy()

    // Act & Assert
    await expect(proxy.callPluginTool(3000, 'nonexistent_tool')).rejects.toThrow('Plugin error (HTTP 404)')
    // Re-call to verify body is included in error message
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '{"error":"Internal Server Error"}',
    })
    await expect(proxy.callPluginTool(3000, 'get_logs')).rejects.toThrow('Internal Server Error')
  })

  it('should throw on HTTP 403 Forbidden (non-localhost)', async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Access allowed only from localhost',
    })
    const proxy = new DevToolsProxy()

    // Act & Assert
    await expect(proxy.callPluginTool(3000, 'get_logs')).rejects.toThrow('Plugin error (HTTP 403)')
  })

  it('should propagate network errors directly', async () => {
    // Arrange
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const proxy = new DevToolsProxy()

    // Act & Assert
    await expect(proxy.callPluginTool(3000, 'get_logs')).rejects.toThrow('ECONNREFUSED')
  })

  it('should construct correct URL for different tool names', async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    const proxy = new DevToolsProxy()

    // Act
    await proxy.callPluginTool(4000, 'get_routes', { verbose: true })

    // Assert
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/_dev/mcp/tools/get_routes',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('should call get_routes endpoint and return parsed route data', async () => {
    // Arrange: mock response matching McpGetRoutesResponse shape
    const routeData = {
      routes: [
        { method: 'GET', path: '/users', controllerName: 'UserController', handlerName: 'findAll' },
        { method: 'POST', path: '/users', controllerName: 'UserController', handlerName: 'create' },
      ],
      total: 2,
    }
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => routeData,
    })
    const proxy = new DevToolsProxy()

    // Act
    const result = await proxy.callPluginTool(3000, 'get_routes', {})

    // Assert: correct URL
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/_dev/mcp/tools/get_routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    // Assert: correct data
    expect(result).toEqual(routeData)
  })

  it('should send empty object body for get_routes with no params', async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ routes: [], total: 0 }),
    })
    const proxy = new DevToolsProxy()

    // Act
    await proxy.callPluginTool(3000, 'get_routes')

    // Assert: body is empty object
    const callArgs = mockFetch.mock.calls[0]
    expect(JSON.parse(callArgs[1].body)).toEqual({})
  })

  it('respects NESTJS_MCP_PREFIX when calling plugin tools', async () => {
    process.env.NESTJS_MCP_PREFIX = '/api'

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entries: [] }),
    })

    const proxy = new DevToolsProxy()

    await proxy.callPluginTool(3000, 'get_logs', { lines: 10 })

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/_dev/mcp/tools/get_logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: 10 }),
    })

    delete process.env.NESTJS_MCP_PREFIX
  })

  it('normalizes NESTJS_MCP_PREFIX without duplicate slashes', async () => {
    process.env.NESTJS_MCP_PREFIX = 'api/'

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })

    const proxy = new DevToolsProxy()

    await proxy.callPluginTool(3000, 'get_routes', {})

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/_dev/mcp/tools/get_routes',
      expect.objectContaining({
        method: 'POST',
      }),
    )

    delete process.env.NESTJS_MCP_PREFIX
  })
})
