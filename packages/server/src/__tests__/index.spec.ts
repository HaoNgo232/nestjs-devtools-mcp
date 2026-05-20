import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
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
  let listPromptsHandler: any
  let getPromptHandler: any
  let listResourcesHandler: any
  let readResourceHandler: any

  beforeAll(() => {
    // Capture the registered request handlers - Lấy các handler đã đăng ký để test
    // Each call to setRequestHandler saves the handler in our local variables
    const calls = (server.setRequestHandler as jest.Mock).mock.calls
    for (const call of calls) {
      if (call[0] === ListToolsRequestSchema) {
        listToolsHandler = call[1]
      } else if (call[0] === CallToolRequestSchema) {
        callToolHandler = call[1]
      } else if (call[0] === ListPromptsRequestSchema) {
        listPromptsHandler = call[1]
      } else if (call[0] === GetPromptRequestSchema) {
        getPromptHandler = call[1]
      } else if (call[0] === ListResourcesRequestSchema) {
        listResourcesHandler = call[1]
      } else if (call[0] === ReadResourceRequestSchema) {
        readResourceHandler = call[1]
      }
    }
  })

  it('should have registered tool handlers', () => {
    expect(listToolsHandler).toBeDefined()
    expect(callToolHandler).toBeDefined()
    expect(listPromptsHandler).toBeDefined()
    expect(getPromptHandler).toBeDefined()
    expect(listResourcesHandler).toBeDefined()
    expect(readResourceHandler).toBeDefined()
  })

  describe('List Tools Handler', () => {
    it('should return the available tools list', async () => {
      const result = await listToolsHandler()
      expect(result.tools).toHaveLength(5)
      expect(result.tools.map((t: any) => t.name)).toContain('discover_servers')
      expect(result.tools.map((t: any) => t.name)).toContain('get_logs')
      expect(result.tools.map((t: any) => t.name)).toContain('get_routes')
      expect(result.tools.map((t: any) => t.name)).toContain('get_request_history')
      expect(result.tools.map((t: any) => t.name)).toContain('get_config')
    })
  })

  describe('Prompt Handlers', () => {
    it('should return available prompts', async () => {
      const result = await listPromptsHandler()

      expect(result.prompts).toHaveLength(1)
      expect(result.prompts[0].name).toBe('install_nestjs_devtools_mcp')
    })

    it('should return quickstart prompt content', async () => {
      const result = await getPromptHandler({
        params: {
          name: 'install_nestjs_devtools_mcp',
        },
      })

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].content.type).toBe('text')
      expect(result.messages[0].content.text).toContain('npm install @nestjs-devtools-mcp/plugin')
    })

    it('should throw error for unsupported prompt', async () => {
      await expect(
        getPromptHandler({
          params: {
            name: 'invalid_prompt',
          },
        }),
      ).rejects.toThrow('Prompt not supported: invalid_prompt')
    })
  })

  describe('Resource Handlers', () => {
    it('should return available resources', async () => {
      const result = await listResourcesHandler()

      expect(result.resources).toHaveLength(1)
      expect(result.resources[0].uri).toBe('nestjs-devtools://runtime-guide')
    })

    it('should return runtime guide resource content', async () => {
      const result = await readResourceHandler({
        params: {
          uri: 'nestjs-devtools://runtime-guide',
        },
      })

      expect(result.contents).toHaveLength(1)
      expect(result.contents[0].mimeType).toBe('application/json')
      expect(result.contents[0].text).toContain('nestjs-devtools-mcp')
      expect(result.contents[0].text).toContain('discover_servers')
      expect(result.contents[0].text).toContain('get_request_history')
      expect(result.contents[0].text).toContain('get_config')
    })

    it('should throw error for missing resource', async () => {
      await expect(
        readResourceHandler({
          params: {
            uri: 'nestjs-devtools://missing',
          },
        }),
      ).rejects.toThrow('Resource not found: nestjs-devtools://missing')
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

    it('should handle get_request_history tool', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockResolvedValue(3002)
      jest.spyOn(devtoolsProxy, 'callPluginTool').mockResolvedValue({ entries: [] })

      const result = await callToolHandler({
        params: {
          name: 'get_request_history',
          arguments: {
            port: 3002,
            limit: 25,
            method: 'POST',
            statusCode: 500,
            statusClass: '5xx',
            pathContains: '/api',
            minDurationMs: 100,
            onlyErrors: true,
          },
        },
      })

      expect(devtoolsProxy.resolvePort).toHaveBeenCalledWith(3002)
      expect(devtoolsProxy.callPluginTool).toHaveBeenCalledWith(3002, 'get_request_history', {
        limit: 25,
        method: 'POST',
        statusCode: 500,
        statusClass: '5xx',
        pathContains: '/api',
        minDurationMs: 100,
        onlyErrors: true,
      })
      expect(JSON.parse(result.content[0].text)).toEqual({ entries: [] })
    })

    it('should handle get_config tool', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockResolvedValue(3003)
      jest.spyOn(devtoolsProxy, 'callPluginTool').mockResolvedValue({ entries: [] })

      const result = await callToolHandler({
        params: {
          name: 'get_config',
          arguments: {
            port: 3003,
            source: 'config-service',
            keyContains: 'DATABASE',
            includeMasked: true,
          },
        },
      })

      expect(devtoolsProxy.resolvePort).toHaveBeenCalledWith(3003)
      expect(devtoolsProxy.callPluginTool).toHaveBeenCalledWith(3003, 'get_config', {
        source: 'config-service',
        keyContains: 'DATABASE',
        includeMasked: true,
      })
      expect(JSON.parse(result.content[0].text)).toEqual({ entries: [] })
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
