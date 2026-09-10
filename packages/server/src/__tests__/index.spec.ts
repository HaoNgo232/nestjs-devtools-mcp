import * as discovery from '../discovery.js'
import { server, devtoolsProxy, runServer } from '../index.js'
import { QUICKSTART_PROMPT_NAME, RUNTIME_GUIDE_URI } from '../constants.js'

jest.mock('../discovery.js')
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({})),
}))

describe('MCP Bridge Entry Point (index.ts) with McpServer', () => {
  let registeredTools: Record<string, any>
  let registeredPrompts: Record<string, any>
  let registeredResources: Record<string, any>

  beforeAll(() => {
    registeredTools = (server as any)._registeredTools
    registeredPrompts = (server as any)._registeredPrompts
    registeredResources = (server as any)._registeredResources
  })

  it('should have registered tools, prompts and resources in McpServer', () => {
    expect(registeredTools).toBeDefined()
    expect(registeredPrompts).toBeDefined()
    expect(registeredResources).toBeDefined()
  })

  describe('List Tools Handler', () => {
    it('should register all expected baseline tools', () => {
      const toolNames = Object.keys(registeredTools)
      expect(toolNames.length).toBeGreaterThanOrEqual(6)
      expect(toolNames).toContain('nestjs_discover_servers')
      expect(toolNames).toContain('get_logs')
      expect(toolNames).toContain('get_routes')
      expect(toolNames).toContain('get_request_history')
      expect(toolNames).toContain('get_config')
      expect(toolNames).toContain('get_errors')
    })
  })

  describe('Prompt Handlers', () => {
    it('should return available prompts', () => {
      expect(registeredPrompts[QUICKSTART_PROMPT_NAME]).toBeDefined()
      expect(registeredPrompts[QUICKSTART_PROMPT_NAME].title).toBe('Install NestJS DevTools MCP')
    })

    it('should return quickstart prompt content', async () => {
      const prompt = registeredPrompts[QUICKSTART_PROMPT_NAME]
      const result = await prompt.callback({})

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].content.type).toBe('text')
      expect(result.messages[0].content.text).toContain('npx nestjs-devtools-mcp init')
    })

    it('quickstart prompt recommends zero-code setup without manual logger', async () => {
      const prompt = registeredPrompts[QUICKSTART_PROMPT_NAME]
      const result = await prompt.callback({})
      const text = result.messages[0].content.text

      expect(text).not.toContain('applyDevtoolsLogger(app)')
      expect(text).not.toContain('import { applyDevtoolsLogger')
      expect(text).toContain('npx nestjs-devtools-mcp init')
      expect(text).toContain('npm run start:dev')
    })

    it('should throw error for unsupported prompt', () => {
      expect(registeredPrompts['invalid_prompt']).toBeUndefined()
    })
  })

  describe('Resource Handlers', () => {
    it('should return available resources', () => {
      expect(registeredResources[RUNTIME_GUIDE_URI]).toBeDefined()
    })

    it('should return runtime guide resource content', async () => {
      const resource = registeredResources[RUNTIME_GUIDE_URI]
      const result = await resource.readCallback(new URL(RUNTIME_GUIDE_URI))

      expect(result.contents).toHaveLength(1)
      expect(result.contents[0].mimeType).toBe('application/json')
      expect(result.contents[0].text).toContain('nestjs-devtools-mcp')
    })

    it('runtime guide describes zero-code setup', async () => {
      const resource = registeredResources[RUNTIME_GUIDE_URI]
      const result = await resource.readCallback(new URL(RUNTIME_GUIDE_URI))
      const guide = JSON.parse(result.contents[0].text)

      expect(guide.setup.zeroCodeSetup.initCommand).toBe('npx nestjs-devtools-mcp init')
    })

    it('should not find unmapped resource', () => {
      expect(registeredResources['nestjs-devtools://missing']).toBeUndefined()
    })
  })

  describe('Call Tool Handler', () => {
    const callTool = async (name: string, args: any = {}) => {
      const tool = registeredTools[name]
      if (!tool) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Tool not supported: ${name}` }],
        }
      }
      try {
        return await tool.handler(args)
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message || String(err) }],
        }
      }
    }

    it('should handle nestjs_discover_servers tool', async () => {
      const mockServers = [{ port: 3000, name: 'test-app' }]
      ;(discovery.discoverServers as jest.Mock).mockResolvedValue(mockServers)

      const result = await callTool('nestjs_discover_servers', { response_format: 'json' })
      expect(discovery.discoverServers).toHaveBeenCalled()
      expect(JSON.parse(result.content[0].text)).toEqual(mockServers)
    })

    it('should handle get_logs tool', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(devtoolsProxy, 'callPluginTool').mockResolvedValue({ logs: [] })

      const result = await callTool('get_logs', { port: 3000, lines: 10, requestId: 'req-123' })

      expect(devtoolsProxy.resolvePort).toHaveBeenCalledWith(3000)
      expect(devtoolsProxy.callPluginTool).toHaveBeenCalledWith(3000, 'get_logs', {
        lines: 10,
        level: undefined,
        requestId: 'req-123',
      })
      expect(JSON.parse(result.content[0].text)).toEqual({ logs: [] })
    })

    it('should handle get_routes tool', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockResolvedValue(3001)
      jest.spyOn(devtoolsProxy, 'callPluginTool').mockResolvedValue({ routes: [] })

      const result = await callTool('get_routes', { port: 3001 })

      expect(devtoolsProxy.resolvePort).toHaveBeenCalledWith(3001)
      expect(devtoolsProxy.callPluginTool).toHaveBeenCalledWith(3001, 'get_routes', {})
      expect(JSON.parse(result.content[0].text)).toEqual({ routes: [] })
    })

    it('should handle get_request_history tool', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockResolvedValue(3002)
      jest.spyOn(devtoolsProxy, 'callPluginTool').mockResolvedValue({ entries: [] })

      const result = await callTool('get_request_history', {
        port: 3002,
        limit: 25,
        method: 'POST',
        statusCode: 500,
        statusClass: '5xx',
        pathContains: '/api',
        minDurationMs: 100,
        onlyErrors: true,
        requestId: 'req-456',
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
        requestId: 'req-456',
      })
      expect(JSON.parse(result.content[0].text)).toEqual({ entries: [] })
    })

    it('should handle get_config tool', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockResolvedValue(3003)
      jest.spyOn(devtoolsProxy, 'callPluginTool').mockResolvedValue({ entries: [] })

      const result = await callTool('get_config', {
        port: 3003,
        source: 'config-service',
        keyContains: 'DATABASE',
        includeMasked: true,
      })

      expect(devtoolsProxy.resolvePort).toHaveBeenCalledWith(3003)
      expect(devtoolsProxy.callPluginTool).toHaveBeenCalledWith(3003, 'get_config', {
        source: 'config-service',
        keyContains: 'DATABASE',
        includeMasked: true,
      })
      expect(JSON.parse(result.content[0].text)).toEqual({ entries: [] })
    })

    it('should handle get_errors tool with all filters', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockResolvedValue(3004)
      jest.spyOn(devtoolsProxy, 'callPluginTool').mockResolvedValue({ entries: [] })

      const result = await callTool('get_errors', {
        port: 3004,
        limit: 25,
        source: 'unhandled',
        since: 1234567890,
        requestId: 'req-9',
        onlyUnhandled: true,
        includeStack: false,
      })

      expect(devtoolsProxy.resolvePort).toHaveBeenCalledWith(3004)
      expect(devtoolsProxy.callPluginTool).toHaveBeenCalledWith(3004, 'get_errors', {
        limit: 25,
        source: 'unhandled',
        since: 1234567890,
        requestId: 'req-9',
        onlyUnhandled: true,
        includeStack: false,
      })
      expect(JSON.parse(result.content[0].text)).toEqual({ entries: [] })
    })

    it('should throw error for unsupported tool', async () => {
      const result = await callTool('invalid_tool', {})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Tool not supported: invalid_tool')
    })

    it('should handle generic errors gracefully', async () => {
      jest.spyOn(devtoolsProxy, 'resolvePort').mockRejectedValue(new Error('no server'))

      const result = await callTool('get_logs', {})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('no server')
    })
  })

  describe('Server Lifecycle', () => {
    it('should connect to transport when runServer is called', async () => {
      const spyConsole = jest.spyOn(console, 'error').mockImplementation()
      const spyConnect = jest.spyOn(server, 'connect').mockResolvedValue(undefined as any)

      await runServer()

      expect(spyConnect).toHaveBeenCalled()
      expect(spyConsole).toHaveBeenCalledWith(expect.stringContaining('started and is listening on STDIO'))

      spyConsole.mockRestore()
      spyConnect.mockRestore()
    })
  })
})
