import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as discovery from '../discovery.js'
import { registerDiscoveryTools, formatUptime, formatServersMarkdown } from '../tools/discovery.tool.js'
import { ResponseFormat, NestServerInfo } from '../types.js'

jest.mock('../discovery.js')

describe('Discovery Tool (nestjs_discover_servers)', () => {
  let server: McpServer
  let registeredTools: Record<string, any>

  beforeEach(() => {
    jest.clearAllMocks()
    server = new McpServer({ name: 'test-server', version: '1.0.0' })
    registerDiscoveryTools(server)
    registeredTools = (server as any)._registeredTools
  })

  describe('Tool Registration & Metadata', () => {
    it('should register tool under the standardized name nestjs_discover_servers', () => {
      expect(registeredTools['nestjs_discover_servers']).toBeDefined()
    })

    it('should have comprehensive title and agent-first description', () => {
      const tool = registeredTools['nestjs_discover_servers']
      expect(tool.title).toBe('Discover NestJS DevTools Servers')
      expect(tool.description).toContain('Scan localhost for running NestJS applications')
      expect(tool.description).toContain('### Args:')
      expect(tool.description).toContain('### Returns:')
      expect(tool.description).toContain('### Examples:')
      expect(tool.description).toContain('### Error Handling:')
      expect(tool.description).toContain('Use when:')
      expect(tool.description).toContain("Don't use when:")
    })

    it('should declare correct behavioral annotations', () => {
      const tool = registeredTools['nestjs_discover_servers']
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      })
    })

    it('should define input schema with start_port, end_port, and response_format', () => {
      const tool = registeredTools['nestjs_discover_servers']
      const shape = tool.inputSchema?.shape || tool.inputSchema
      expect(shape).toBeDefined()
      expect(shape.start_port).toBeDefined()
      expect(shape.end_port).toBeDefined()
      expect(shape.response_format).toBeDefined()
    })
  })

  describe('Tool Execution', () => {
    const mockServers: NestServerInfo[] = [
      {
        port: 3000,
        pid: 12345,
        name: 'nestjs-devtools-mcp',
        version: '0.1.0',
        uptime: 42,
        healthUrl: 'http://localhost:3000/_dev/mcp/health',
      },
      {
        port: 3001,
        pid: 12346,
        name: 'orders-service',
        version: '1.2.0',
        uptime: 135,
        healthUrl: 'http://localhost:3001/_dev/mcp/health',
      },
    ]

    const callTool = async (args: any) => {
      const tool = registeredTools['nestjs_discover_servers']
      return await tool.handler(args)
    }

    it('should default to markdown format and return Markdown table with required columns', async () => {
      ;(discovery.discoverServers as jest.Mock).mockResolvedValue(mockServers)

      const result = await callTool({})

      expect(discovery.discoverServers).toHaveBeenCalledWith(undefined, undefined)
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const text = result.content[0].text
      // Verify Markdown table columns
      expect(text).toContain('| Port | PID | App Name | Version | Uptime | Health URL |')
      expect(text).toContain(
        '| 3000 | 12345 | nestjs-devtools-mcp | 0.1.0 | 42s | http://localhost:3000/_dev/mcp/health |',
      )
      expect(text).toContain(
        '| 3001 | 12346 | orders-service | 1.2.0 | 2m 15s | http://localhost:3001/_dev/mcp/health |',
      )

      // Verify structuredContent
      expect(result.structuredContent).toEqual({
        servers: mockServers,
        count: 2,
      })
      expect(result.isError).toBeFalsy()
    })

    it('should format message when no servers are discovered in markdown mode', async () => {
      ;(discovery.discoverServers as jest.Mock).mockResolvedValue([])

      const result = await callTool({ start_port: 3000, end_port: 3005, response_format: ResponseFormat.MARKDOWN })

      expect(discovery.discoverServers).toHaveBeenCalledWith(3000, 3005)
      const text = result.content[0].text
      expect(text).toContain('No active NestJS DevTools servers found on localhost (scanned ports: 3000-3005).')
      expect(text).toContain('npm run start:dev')
      expect(text).toContain('npx nestjs-devtools-mcp init')

      expect(result.structuredContent).toEqual({
        servers: [],
        count: 0,
      })
    })

    it('should return indented JSON text and structuredContent when response_format is json', async () => {
      ;(discovery.discoverServers as jest.Mock).mockResolvedValue(mockServers)

      const result = await callTool({
        start_port: 3000,
        end_port: 3010,
        response_format: ResponseFormat.JSON,
      })

      expect(discovery.discoverServers).toHaveBeenCalledWith(3000, 3010)
      expect(result.content[0].type).toBe('text')
      expect(JSON.parse(result.content[0].text)).toEqual(mockServers)
      // Check indentation
      expect(result.content[0].text).toBe(JSON.stringify(mockServers, null, 2))

      expect(result.structuredContent).toEqual({
        servers: mockServers,
        count: 2,
      })
    })

    it('should return an actionable error when start_port is greater than end_port', async () => {
      const result = await callTool({ start_port: 4000, end_port: 3000 })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('start_port (4000) cannot be greater than end_port (3000)')
      expect(discovery.discoverServers).not.toHaveBeenCalled()
    })

    it('should handle unexpected discoverServers failures gracefully with actionable error', async () => {
      ;(discovery.discoverServers as jest.Mock).mockRejectedValue(
        new Error('Permission denied scanning network sockets'),
      )

      const result = await callTool({ start_port: 3000, end_port: 3010 })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain(
        'Failed to scan for NestJS DevTools servers: Permission denied scanning network sockets',
      )
      expect(result.content[0].text).toContain('Check network access')
    })
  })

  describe('Helper Functions', () => {
    describe('formatUptime', () => {
      it('should format seconds correctly', () => {
        expect(formatUptime(0)).toBe('0s')
        expect(formatUptime(45)).toBe('45s')
        expect(formatUptime(59)).toBe('59s')
      })

      it('should format minutes and seconds correctly', () => {
        expect(formatUptime(60)).toBe('1m 0s')
        expect(formatUptime(135)).toBe('2m 15s')
        expect(formatUptime(3599)).toBe('59m 59s')
      })

      it('should format hours and minutes correctly', () => {
        expect(formatUptime(3600)).toBe('1h 0m')
        expect(formatUptime(7320)).toBe('2h 2m')
      })
    })

    describe('formatServersMarkdown', () => {
      it('should render correct table header and rows', () => {
        const testServers: NestServerInfo[] = [
          {
            port: 4000,
            pid: 999,
            name: 'api-gateway',
            version: '2.0.0',
            uptime: 3600,
            healthUrl: 'http://localhost:4000/_dev/mcp/health',
          },
        ]

        const markdown = formatServersMarkdown(testServers)
        expect(markdown).toContain('| Port | PID | App Name | Version | Uptime | Health URL |')
        expect(markdown).toContain(
          '| 4000 | 999 | api-gateway | 2.0.0 | 1h 0m | http://localhost:4000/_dev/mcp/health |',
        )
      })
    })
  })
})
