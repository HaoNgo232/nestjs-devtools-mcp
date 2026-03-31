import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import * as discovery from '../discovery'

// Mock SDK before importing index.ts
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
  })),
}))

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}))

import { server, devtoolsProxy, runServer } from '../index'

jest.mock('../discovery')

describe('MCP Bridge Entry Point (index.ts)', () => {
  let listToolsHandler: any
  let callToolHandler: any

  beforeAll(() => {
    // Capture the registered request handlers - Lấy các handler đã đăng ký để test
    // Each call to setRequestHandler saves the handler in our local variables
    const calls = (server.setRequestHandler as jest.Mock).mock.calls
    for (const call of calls) {
      if (call[0] === ListToolsRequestSchema) {
        listToolsHandler = call[1]
      } else if (call[0] === CallToolRequestSchema) {
        callToolHandler = call[1]
      }
    }
  })

  it('should have registered tool handlers', () => {
    expect(listToolsHandler).toBeDefined()
    expect(callToolHandler).toBeDefined()
  })

  describe('List Tools Handler', () => {
    it('should return the available tools list', async () => {
      const result = await listToolsHandler()
      expect(result.tools).toHaveLength(3)
      expect(result.tools.map((t: any) => t.name)).toContain('discover_servers')
      expect(result.tools.map((t: any) => t.name)).toContain('get_logs')
      expect(result.tools.map((t: any) => t.name)).toContain('get_routes')
    })
  })

  describe('Call Tool Handler', () => {
    it('should handle discover_servers tool', async () => {
      const mockServers = [{ port: 3000, name: 'test-app' }]
      ;(discovery.discoverServers as jest.Mock).mockResolvedValue(mockServers)

      const result = await callToolHandler({
        params: {
          name: 'discover_servers',
          arguments: {},
        },
      })

      expect(discovery.discoverServers).toHaveBeenCalled()
      expect(JSON.parse(result.content[0].text)).toEqual(mockServers)
    })

    it('should handle get_logs tool', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(devtoolsProxy, 'callPluginTool').mockResolvedValue({ logs: [] })

      const result = await callToolHandler({
        params: {
          name: 'get_logs',
          arguments: { port: 3000, lines: 10 },
        },
      })

      expect(devtoolsProxy.resolvePort).toHaveBeenCalledWith(3000)
      expect(devtoolsProxy.callPluginTool).toHaveBeenCalledWith(3000, 'get_logs', {
        lines: 10,
        level: undefined,
      })
      expect(JSON.parse(result.content[0].text)).toEqual({ logs: [] })
    })

    it('should handle get_routes tool', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockResolvedValue(3001)
      jest.spyOn(devtoolsProxy, 'callPluginTool').mockResolvedValue({ routes: [] })

      const result = await callToolHandler({
        params: {
          name: 'get_routes',
          arguments: { port: 3001 },
        },
      })

      expect(devtoolsProxy.resolvePort).toHaveBeenCalledWith(3001)
      expect(devtoolsProxy.callPluginTool).toHaveBeenCalledWith(3001, 'get_routes', {})
      expect(JSON.parse(result.content[0].text)).toEqual({ routes: [] })
    })

    it('should throw error for unsupported tool', async () => {
      const result = await callToolHandler({
        params: {
          name: 'invalid_tool',
          arguments: {},
        },
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Tool not supported: invalid_tool')
    })

    it('should handle generic errors gracefully', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockRejectedValue(new Error('no server'))

      const result = await callToolHandler({
        params: {
          name: 'get_logs',
          arguments: {},
        },
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('no server')
    })
  })

  describe('Server Lifecycle', () => {
    it('should connect to transport when runServer is called', async () => {
      const spyConsole = jest.spyOn(console, 'error').mockImplementation()

      await runServer()

      expect(server.connect).toHaveBeenCalled()
      expect(spyConsole).toHaveBeenCalledWith(expect.stringContaining('started and is listening on STDIO'))

      spyConsole.mockRestore()
    })
  })
})
