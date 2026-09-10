import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { DevToolsProxy } from '../proxy.js'
import { registerRoutesTools, formatRoutesMarkdown, RouteInfo } from '../tools/routes.tool.js'
import { registerConfigTools, formatConfigMarkdown, ConfigCollectorData } from '../tools/config.tool.js'
import { formatActionableError } from '../tools/error-formatter.js'
import { GetRoutesInputSchema } from '../schemas/routes.schema.js'
import { GetConfigInputSchema } from '../schemas/config.schema.js'

describe('Modernized Routes & Config Tools (Ticket 03)', () => {
  let server: McpServer
  let proxy: DevToolsProxy
  let registeredTools: Record<string, any>

  beforeEach(() => {
    server = new McpServer({ name: 'test-server', version: '1.0.0' })
    proxy = new DevToolsProxy()
    registerRoutesTools(server, proxy)
    registerConfigTools(server, proxy)
    registeredTools = (server as any)._registeredTools
  })

  describe('Tool Registration & Metadata', () => {
    it('registers nestjs_get_routes with agent-first description and annotations', () => {
      const tool = registeredTools['nestjs_get_routes']
      expect(tool).toBeDefined()
      expect(tool.title).toBe('Get NestJS Routes')
      expect(tool.description).toContain('### Args:')
      expect(tool.description).toContain('### Returns:')
      expect(tool.description).toContain('### Examples:')
      expect(tool.description).toContain('### Error Handling:')
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      })
    })

    it('registers nestjs_get_config with agent-first description and annotations', () => {
      const tool = registeredTools['nestjs_get_config']
      expect(tool).toBeDefined()
      expect(tool.title).toBe('Get NestJS Configuration')
      expect(tool.description).toContain('### Args:')
      expect(tool.description).toContain('### Returns:')
      expect(tool.description).toContain('### Examples:')
      expect(tool.description).toContain('### Error Handling:')
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      })
    })

    it('maintains legacy tool aliases for backward compatibility', () => {
      expect(registeredTools['get_routes']).toBeDefined()
      expect(registeredTools['get_config']).toBeDefined()
    })
  })

  describe('Zod Schema Validation', () => {
    it('validates GetRoutesInputSchema fields', () => {
      const schema = z.object(GetRoutesInputSchema)
      const valid = schema.parse({
        port: 3000,
        method: 'GET',
        path_contains: '/api/v1',
        response_format: 'json',
      })
      expect(valid.port).toBe(3000)
      expect(valid.method).toBe('GET')
      expect(valid.path_contains).toBe('/api/v1')
      expect(valid.response_format).toBe('json')

      // Defaults to markdown
      const defaultParsed = schema.parse({})
      expect(defaultParsed.response_format).toBe('markdown')
    })

    it('validates GetConfigInputSchema and rejects invalid sources', () => {
      const schema = z.object(GetConfigInputSchema)
      const valid = schema.parse({
        port: 3001,
        source: 'env',
        key_contains: 'DATABASE',
        include_masked: false,
        response_format: 'markdown',
      })
      expect(valid.source).toBe('env')
      expect(valid.include_masked).toBe(false)

      expect(() => {
        schema.parse({ source: 'invalid-source' as any })
      }).toThrow()
    })
  })

  describe('nestjs_get_routes Handler & Formatting', () => {
    const mockRoutes: RouteInfo[] = [
      { method: 'GET', path: '/users', controllerName: 'UsersController', handlerName: 'findAll' },
      { method: 'POST', path: '/users', controllerName: 'UsersController', handlerName: 'create' },
      { method: 'GET', path: '/users/:id', controllerName: 'UsersController', handlerName: 'findOne' },
      { method: 'GET', path: '/health', controllerName: 'HealthController', handlerName: 'check' },
    ]

    beforeEach(() => {
      jest.spyOn(proxy, 'resolvePort').mockImplementation(async (port?: number) => port ?? 3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({ routes: mockRoutes, total: mockRoutes.length })
    })

    it('returns grouped Markdown table by default', async () => {
      const tool = registeredTools['nestjs_get_routes']
      const result = await tool.handler({})

      expect(proxy.resolvePort).toHaveBeenCalled()
      expect(proxy.callPluginTool).toHaveBeenCalledWith(3000, 'get_routes', {})

      const text = result.content[0].text
      expect(text).toContain('## Registered HTTP Routes (4 total)')
      expect(text).toContain('### UsersController')
      expect(text).toContain('| `GET` | `/users` | `findAll` |')
      expect(text).toContain('| `POST` | `/users` | `create` |')
      expect(text).toContain('### HealthController')
      expect(text).toContain('| `GET` | `/health` | `check` |')

      expect(result.structuredContent).toEqual({
        routes: mockRoutes,
        total: 4,
      })
    })

    it('filters routes by method (case-insensitive)', async () => {
      const tool = registeredTools['nestjs_get_routes']
      const result = await tool.handler({ method: 'post' })

      const text = result.content[0].text
      expect(text).toContain('## Registered HTTP Routes (1 total)')
      expect(text).toContain('*Filters applied: method = `POST`*')
      expect(text).toContain('### UsersController')
      expect(text).toContain('| `POST` | `/users` | `create` |')
      expect(text).not.toContain('### HealthController')

      expect(result.structuredContent).toEqual({
        routes: [mockRoutes[1]],
        total: 1,
      })
    })

    it('filters routes by path_contains (case-insensitive)', async () => {
      const tool = registeredTools['nestjs_get_routes']
      const result = await tool.handler({ path_contains: 'HEALTH' })

      const text = result.content[0].text
      expect(text).toContain('## Registered HTTP Routes (1 total)')
      expect(text).toContain('### HealthController')
      expect(text).not.toContain('### UsersController')

      expect(result.structuredContent).toEqual({
        routes: [mockRoutes[3]],
        total: 1,
      })
    })

    it('returns JSON format when response_format is json', async () => {
      const tool = registeredTools['nestjs_get_routes']
      const result = await tool.handler({ response_format: 'json' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual({
        routes: mockRoutes,
        total: 4,
      })
      expect(result.structuredContent).toEqual(parsed)
    })

    it('renders empty notice when no routes match filter', () => {
      const formatted = formatRoutesMarkdown([], { method: 'DELETE', path_contains: '/missing' })
      expect(formatted).toContain('No routes found matching the specified criteria.')
      expect(formatted).toContain('Filters applied: method = `DELETE`, path contains `/missing`')
    })
  })

  describe('nestjs_get_config Handler & Formatting', () => {
    const mockConfigData: ConfigCollectorData = {
      entries: [
        { source: 'env', key: 'NODE_ENV', status: 'set', masked: false, value: 'test', type: 'string' },
        {
          source: 'env',
          key: 'DATABASE_PASSWORD',
          status: 'masked',
          masked: true,
          value: '***MASKED***',
          type: 'string',
        },
        { source: 'config-service', key: 'app.port', status: 'set', masked: false, value: 3000, type: 'number' },
        { source: 'env', key: 'OPTIONAL_TOKEN', status: 'empty', masked: false, value: null, type: 'undefined' },
      ],
      total: 4,
      configServiceAvailable: true,
      nodeEnv: 'test',
      warnings: ['Custom warning notice'],
    }

    beforeEach(() => {
      jest.spyOn(proxy, 'resolvePort').mockImplementation(async (port?: number) => port ?? 3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue(mockConfigData)
    })

    it('returns Markdown format with masked secret badges by default', async () => {
      const tool = registeredTools['nestjs_get_config']
      const result = await tool.handler({})

      expect(proxy.resolvePort).toHaveBeenCalled()
      expect(proxy.callPluginTool).toHaveBeenCalledWith(
        3000,
        'get_config',
        expect.objectContaining({
          source: 'all',
          includeMasked: true,
        }),
      )

      const text = result.content[0].text
      expect(text).toContain('## NestJS Configuration (4 entries)')
      expect(text).toContain('- **Environment:** `test`')
      expect(text).toContain('- **ConfigService Active:** Yes')
      expect(text).toContain('> ⚠️ **Warnings:**')
      expect(text).toContain('> - Custom warning notice')
      expect(text).toContain('| `DATABASE_PASSWORD` | `env` | `string` | `masked` | 🔒 `[MASKED]` |')
      expect(text).toContain('| `NODE_ENV` | `env` | `string` | `set` | `test` |')
      expect(text).toContain('| `app.port` | `config-service` | `number` | `set` | `3000` |')
      expect(text).toContain('| `OPTIONAL_TOKEN` | `env` | `undefined` | `empty` | *(empty)* |')

      expect(result.structuredContent).toEqual(mockConfigData)
    })

    it('returns JSON format when response_format is json', async () => {
      const tool = registeredTools['nestjs_get_config']
      const result = await tool.handler({ response_format: 'json' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.total).toBe(4)
      expect(parsed.entries).toHaveLength(4)
      expect(result.structuredContent).toEqual(parsed)
    })

    it('forwards filters (source, key_contains, include_masked)', async () => {
      const tool = registeredTools['nestjs_get_config']
      await tool.handler({
        port: 3005,
        source: 'config-service',
        key_contains: 'port',
        include_masked: false,
      })

      expect(proxy.resolvePort).toHaveBeenCalledWith(3005)
      expect(proxy.callPluginTool).toHaveBeenCalledWith(
        3005,
        'get_config',
        expect.objectContaining({
          source: 'config-service',
          keyContains: 'port',
          includeMasked: false,
        }),
      )
    })

    it('formats empty config results gracefully', () => {
      const emptyData: ConfigCollectorData = {
        entries: [],
        total: 0,
        configServiceAvailable: false,
        nodeEnv: '',
        warnings: [],
      }
      const formatted = formatConfigMarkdown(emptyData, { source: 'config-service', key_contains: 'NONEXISTENT' })
      expect(formatted).toContain('No configuration entries found matching the specified criteria.')
      expect(formatted).toContain('source = `config-service`')
      expect(formatted).toContain('key contains `NONEXISTENT`')
    })
  })

  describe('Actionable Error Handling', () => {
    it('returns actionable guidance when no NestJS server is found', async () => {
      jest
        .spyOn(proxy, 'resolvePort')
        .mockRejectedValue(new Error('No NestJS server found running the DevTools MCP plugin.'))

      const tool = registeredTools['nestjs_get_routes']
      const result = await tool.handler({})

      expect(result.isError).toBe(true)
      const text = result.content[0].text
      expect(text).toContain('[NestJS DevTools Error] Failed to locate active NestJS server')
      expect(text).toContain('Troubleshooting steps:')
      expect(text).toContain('Ensure your NestJS application is running')
      expect(text).toContain('DevtoolsMcpModule is imported')
    })

    it('returns disambiguation guidance when multiple servers are detected', async () => {
      jest
        .spyOn(proxy, 'resolvePort')
        .mockRejectedValue(
          new Error('Multiple NestJS servers found on ports (3000, 3001). Please provide the specific port desired.'),
        )

      const tool = registeredTools['nestjs_get_config']
      const result = await tool.handler({})

      expect(result.isError).toBe(true)
      const text = result.content[0].text
      expect(text).toContain('[NestJS DevTools Error] Multiple NestJS instances detected')
      expect(text).toContain("Action required: Please provide the specific 'port' parameter")
    })

    it('returns connection failure guidance when endpoint is unreachable (ECONNREFUSED / fetch failed)', async () => {
      jest.spyOn(proxy, 'resolvePort').mockImplementation(async (port?: number) => port ?? 3000)
      jest
        .spyOn(proxy, 'callPluginTool')
        .mockRejectedValue(new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:3000'))

      const tool = registeredTools['nestjs_get_routes']
      const result = await tool.handler({ port: 3000 })

      expect(result.isError).toBe(true)
      const text = result.content[0].text
      expect(text).toContain('[NestJS DevTools Error] Unable to connect to NestJS DevTools endpoint on port 3000.')
      expect(text).toContain('Troubleshooting steps:')
      expect(text).toContain('Check whether the application process is alive')
      expect(text).toContain('NESTJS_MCP_PREFIX')
    })

    it('formatActionableError provides generic fallback for other errors', () => {
      const formatted = formatActionableError(new Error('SyntaxError: unexpected token'), 3000, 'test_tool')
      expect(formatted).toContain(
        '[NestJS DevTools Error] Execution of test_tool failed: SyntaxError: unexpected token',
      )
    })
  })
})
