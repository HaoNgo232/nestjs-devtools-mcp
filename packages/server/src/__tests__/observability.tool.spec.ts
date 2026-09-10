import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { registerLogsTools } from '../tools/logs.tool.js'
import { registerHistoryTools } from '../tools/history.tool.js'
import { registerErrorsTools } from '../tools/errors.tool.js'
import { ResponseFormat } from '../types.js'
import { McpLogEntry, RequestHistoryEntry, McpErrorEntry } from '../contracts/mcp-api.contract.js'

describe('Paginated Observability Tools', () => {
  let server: McpServer
  let proxy: DevToolsProxy
  let registeredTools: Record<string, any>

  beforeEach(() => {
    server = new McpServer({ name: 'test-observability', version: '1.0.0' })
    proxy = new DevToolsProxy()
    registeredTools = (server as any)._registeredTools

    registerLogsTools(server, proxy)
    registerHistoryTools(server, proxy)
    registerErrorsTools(server, proxy)
  })

  // Helper to invoke a registered tool handler
  const callTool = async (name: string, args: Record<string, any> = {}) => {
    const tool = registeredTools[name]
    if (!tool) {
      throw new Error(`Tool ${name} not found`)
    }
    return await tool.handler(args)
  }

  // ─────────────────────────────────────────────────────────────
  // 1. Tool Registration & Metadata
  // ─────────────────────────────────────────────────────────────
  describe('Tool Registration & Metadata', () => {
    it('should register tools with standardized names', () => {
      const names = Object.keys(registeredTools)
      expect(names).toContain('nestjs_get_logs')
      expect(names).toContain('nestjs_get_request_history')
      expect(names).toContain('nestjs_get_errors')
    })

    it('should have standard tool annotations for all three tools', () => {
      const expectedAnnotations = {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      }

      expect(registeredTools.nestjs_get_logs.annotations).toEqual(expectedAnnotations)
      expect(registeredTools.nestjs_get_request_history.annotations).toEqual(expectedAnnotations)
      expect(registeredTools.nestjs_get_errors.annotations).toEqual(expectedAnnotations)
    })

    it('should have agent-first descriptions with Args, Returns, Examples, and Error Handling', () => {
      for (const name of ['nestjs_get_logs', 'nestjs_get_request_history', 'nestjs_get_errors']) {
        const desc = registeredTools[name].description
        expect(desc).toContain('### Args:')
        expect(desc).toContain('### Returns:')
        expect(desc).toContain('### Examples:')
        expect(desc).toContain('### Error Handling:')
      }
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. nestjs_get_logs
  // ─────────────────────────────────────────────────────────────
  describe('nestjs_get_logs', () => {
    const mockLogs: McpLogEntry[] = [
      { timestamp: 1710000000000, level: 'log', context: 'AppModule', message: 'Initialized', requestId: null },
      { timestamp: 1710000001000, level: 'warn', context: 'UsersService', message: 'Cache miss', requestId: 'req-1' },
      {
        timestamp: 1710000002000,
        level: 'error',
        context: 'AuthService',
        message: 'Invalid token',
        requestId: 'req-2',
      },
      { timestamp: 1710000003000, level: 'debug', context: 'Database', message: 'Query executed', requestId: null },
      { timestamp: 1710000004000, level: 'verbose', context: 'Router', message: 'Matched route', requestId: 'req-3' },
    ]

    it('should forward filters and pagination parameters to plugin', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      const callSpy = jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockLogs,
        total: 5,
        bufferSize: 100,
      })

      await callTool('nestjs_get_logs', {
        port: 3000,
        limit: 10,
        offset: 0,
        level: 'error',
        request_id: 'req-999',
      })

      expect(proxy.resolvePort).toHaveBeenCalledWith(3000)
      expect(callSpy).toHaveBeenCalledWith(3000, 'get_logs', {
        lines: 10,
        level: 'error',
        requestId: 'req-999',
      })
    })

    it('should support lines and requestId aliases', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      const callSpy = jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockLogs,
        total: 5,
      })

      await callTool('nestjs_get_logs', {
        port: 3000,
        lines: 15,
        requestId: 'req-alias',
      })

      expect(callSpy).toHaveBeenCalledWith(3000, 'get_logs', {
        lines: 15,
        level: undefined,
        requestId: 'req-alias',
      })
    })

    it('should slice entries according to offset and limit', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockLogs,
        total: 5,
      })

      // Page 1: offset 0, limit 2
      const page1 = await callTool('nestjs_get_logs', {
        port: 3000,
        offset: 0,
        limit: 2,
        response_format: 'json',
      })
      const data1 = page1.structuredContent
      expect(data1.total_count).toBe(5)
      expect(data1.has_more).toBe(true)
      expect(data1.next_offset).toBe(2)
      expect(data1.items).toHaveLength(2)
      expect(data1.items[0].message).toBe('Initialized')
      expect(data1.items[1].message).toBe('Cache miss')

      // Page 2: offset 2, limit 2
      const page2 = await callTool('nestjs_get_logs', {
        port: 3000,
        offset: 2,
        limit: 2,
        response_format: 'json',
      })
      const data2 = page2.structuredContent
      expect(data2.total_count).toBe(5)
      expect(data2.has_more).toBe(true)
      expect(data2.next_offset).toBe(4)
      expect(data2.items).toHaveLength(2)
      expect(data2.items[0].message).toBe('Invalid token')
      expect(data2.items[1].message).toBe('Query executed')

      // Page 3: offset 4, limit 2 (last item)
      const page3 = await callTool('nestjs_get_logs', {
        port: 3000,
        offset: 4,
        limit: 2,
        response_format: 'json',
      })
      const data3 = page3.structuredContent
      expect(data3.total_count).toBe(5)
      expect(data3.has_more).toBe(false)
      expect(data3.next_offset).toBeNull()
      expect(data3.items).toHaveLength(1)
      expect(data3.items[0].message).toBe('Matched route')
    })

    it('should handle offset beyond available items', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockLogs,
        total: 5,
      })

      const result = await callTool('nestjs_get_logs', {
        port: 3000,
        offset: 10,
        limit: 5,
        response_format: 'json',
      })
      const data = result.structuredContent
      expect(data.total_count).toBe(5)
      expect(data.has_more).toBe(false)
      expect(data.next_offset).toBeNull()
      expect(data.items).toEqual([])
    })

    it('should format logs in markdown with level badges and pagination footer', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockLogs.slice(0, 2),
        total: 5,
      })

      const result = await callTool('nestjs_get_logs', {
        port: 3000,
        offset: 0,
        limit: 2,
        response_format: 'markdown',
      })

      expect(result.content).toHaveLength(1)
      const markdown = result.content[0].text
      expect(markdown).toContain('### NestJS Runtime Logs')
      expect(markdown).toContain('🟢 [LOG]')
      expect(markdown).toContain('[AppModule] Initialized')
      expect(markdown).toContain('🟡 [WARN]')
      expect(markdown).toContain('*(req: `req-1`)*')
      expect(markdown).toContain('Showing 2 of 5 items, page offset 0')
    })

    it('should return actionable error guidance on connection failure', async () => {
      jest.spyOn(proxy, 'resolvePort').mockRejectedValue(new Error('Connection refused'))

      const result = await callTool('nestjs_get_logs', { port: 3000 })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Failed to execute nestjs_get_logs')
      expect(result.content[0].text).toContain('Actionable Guidance:')
      expect(result.content[0].text).toContain('npm run start:dev')
      expect(result.content[0].text).toContain('nestjs_discover_servers')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 3. nestjs_get_request_history
  // ─────────────────────────────────────────────────────────────
  describe('nestjs_get_request_history', () => {
    const mockRequests: RequestHistoryEntry[] = [
      {
        timestamp: 1710000000000,
        method: 'GET',
        path: '/users',
        routePattern: '/users',
        statusCode: 200,
        durationMs: 15,
        controllerName: 'UsersController',
        handlerName: 'findAll',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        requestSize: 0,
        responseSize: 120,
        error: null,
        requestId: 'req-1',
      },
      {
        timestamp: 1710000001000,
        method: 'POST',
        path: '/users',
        routePattern: '/users',
        statusCode: 400,
        durationMs: 25,
        controllerName: 'UsersController',
        handlerName: 'create',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        requestSize: 50,
        responseSize: 80,
        error: { name: 'BadRequestException', message: 'Email already exists', stack: null },
        requestId: 'req-2',
      },
      {
        timestamp: 1710000002000,
        method: 'GET',
        path: '/admin/stats',
        routePattern: '/admin/stats',
        statusCode: 500,
        durationMs: 210,
        controllerName: 'AdminController',
        handlerName: 'getStats',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        requestSize: 0,
        responseSize: 45,
        error: { name: 'InternalServerError', message: 'DB connection dead', stack: 'Error: dead' },
        requestId: 'req-3',
      },
    ]

    it('should forward all filter options and pagination parameters', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      const callSpy = jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockRequests,
        total: 3,
      })

      await callTool('nestjs_get_request_history', {
        port: 3000,
        limit: 10,
        offset: 0,
        method: 'POST',
        status_code: 400,
        status_class: '4xx',
        path_contains: '/users',
        min_duration_ms: 20,
        only_errors: true,
        request_id: 'req-2',
      })

      expect(callSpy).toHaveBeenCalledWith(3000, 'get_request_history', {
        limit: 10,
        method: 'POST',
        statusCode: 400,
        statusClass: '4xx',
        pathContains: '/users',
        minDurationMs: 20,
        onlyErrors: true,
        requestId: 'req-2',
      })
    })

    it('should slice entries and output structured content', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockRequests,
        total: 3,
      })

      const result = await callTool('nestjs_get_request_history', {
        port: 3000,
        offset: 1,
        limit: 1,
        response_format: 'json',
      })

      const envelope = result.structuredContent
      expect(envelope.total_count).toBe(3)
      expect(envelope.has_more).toBe(true)
      expect(envelope.next_offset).toBe(2)
      expect(envelope.items).toHaveLength(1)
      expect(envelope.items[0].method).toBe('POST')
      expect(envelope.items[0].statusCode).toBe(400)
    })

    it('should format markdown with status code badges and error summaries', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockRequests,
        total: 3,
      })

      const result = await callTool('nestjs_get_request_history', {
        port: 3000,
        offset: 0,
        limit: 3,
        response_format: 'markdown',
      })

      const md = result.content[0].text
      expect(md).toContain('### NestJS Request History')
      expect(md).toContain('🟢 200')
      expect(md).toContain('🟡 400')
      expect(md).toContain('🔴 500')
      expect(md).toContain('`UsersController.findAll`')
      expect(md).toContain('⚠️ **Error in POST /users**: `BadRequestException`')
      expect(md).toContain('Showing 3 of 3 items, page offset 0')
    })

    it('should return actionable error when server is unreachable', async () => {
      jest.spyOn(proxy, 'resolvePort').mockRejectedValue(new Error('No NestJS server found'))

      const result = await callTool('nestjs_get_request_history', {})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Failed to execute nestjs_get_request_history')
      expect(result.content[0].text).toContain('Actionable Guidance:')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 4. nestjs_get_errors
  // ─────────────────────────────────────────────────────────────
  describe('nestjs_get_errors', () => {
    const mockErrors: McpErrorEntry[] = [
      {
        id: 'err-1',
        timestamp: 1710000000000,
        source: 'bootstrap',
        name: 'ModuleInitError',
        message: 'Database connection failed during boot',
        stack: 'Error: Database connection failed\n    at initDatabase (db.ts:10)',
        context: 'TypeOrmModule',
        requestId: null,
        relatedLogTimestamp: null,
      },
      {
        id: 'err-2',
        timestamp: 1710000001000,
        source: 'unhandled',
        name: 'UnhandledPromiseRejection',
        message: 'Uncaught TypeError in background task',
        stack: 'TypeError: Cannot read property of undefined',
        context: null,
        requestId: 'req-async',
        relatedLogTimestamp: null,
      },
      {
        id: 'err-3',
        timestamp: 1710000002000,
        source: 'http-5xx',
        name: 'InternalServerError',
        message: 'HTTP 500 in POST /checkout',
        stack: null,
        context: 'CheckoutController',
        requestId: 'req-500',
        relatedLogTimestamp: null,
      },
    ]

    it('should forward all filter options to plugin tool', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      const callSpy = jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockErrors,
        total: 3,
        unhandledCount: 1,
      })

      await callTool('nestjs_get_errors', {
        port: 3000,
        limit: 20,
        offset: 0,
        source: 'bootstrap',
        since: 1709999999000,
        request_id: 'req-1',
        only_unhandled: true,
        include_stack: true,
      })

      expect(callSpy).toHaveBeenCalledWith(3000, 'get_errors', {
        limit: 20,
        source: 'bootstrap',
        since: 1709999999000,
        requestId: 'req-1',
        onlyUnhandled: true,
        includeStack: true,
      })
    })

    it('should slice entries and output pagination envelope', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockErrors,
        total: 3,
      })

      const result = await callTool('nestjs_get_errors', {
        port: 3000,
        offset: 0,
        limit: 2,
        response_format: 'json',
      })

      const envelope = result.structuredContent
      expect(envelope.total_count).toBe(3)
      expect(envelope.has_more).toBe(true)
      expect(envelope.next_offset).toBe(2)
      expect(envelope.items).toHaveLength(2)
      expect(envelope.items[0].source).toBe('bootstrap')
      expect(envelope.items[1].source).toBe('unhandled')
    })

    it('should format markdown with origin badges, stack traces, and pagination footer', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        entries: mockErrors,
        total: 3,
      })

      const result = await callTool('nestjs_get_errors', {
        port: 3000,
        offset: 0,
        limit: 3,
        response_format: 'markdown',
      })

      const md = result.content[0].text
      expect(md).toContain('### NestJS Runtime Errors')
      expect(md).toContain('💥 [bootstrap] ModuleInitError')
      expect(md).toContain('🔴 [unhandled] UnhandledPromiseRejection')
      expect(md).toContain('🌐 [http-5xx] InternalServerError')
      expect(md).toContain('```text\nError: Database connection failed')
      expect(md).toContain('Showing 3 of 3 items, page offset 0')
    })

    it('should return actionable guidance when proxy encounters an error', async () => {
      jest.spyOn(proxy, 'resolvePort').mockRejectedValue(new Error('Port resolution timeout'))

      const result = await callTool('nestjs_get_errors', {})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Failed to execute nestjs_get_errors')
      expect(result.content[0].text).toContain('Actionable Guidance:')
      expect(result.content[0].text).toContain('npx nestjs-devtools-mcp init')
    })
  })
})
