import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { registerClearBuffersTool } from '../tools/clear-buffers.tool.js'
import { registerDiagnoseHealthTool } from '../tools/diagnose-health.tool.js'
import { ResponseFormat } from '../types.js'

describe('New Tools: ClearBuffers & DiagnoseHealth', () => {
  let server: McpServer
  let proxy: DevToolsProxy
  let registeredTools: Record<string, any>

  beforeEach(() => {
    server = new McpServer({ name: 'test-server', version: '1.0.0' })
    proxy = new DevToolsProxy()
    registerClearBuffersTool(server, proxy)
    registerDiagnoseHealthTool(server, proxy)
    registeredTools = (server as any)._registeredTools
  })

  describe('nestjs_clear_buffers', () => {
    it('should register tool with destructive annotations', () => {
      const tool = registeredTools['nestjs_clear_buffers']
      expect(tool).toBeDefined()
      expect(tool.annotations.destructiveHint).toBe(true)
      expect(tool.annotations.readOnlyHint).toBe(false)
    })

    it('should call clear_buffers endpoint and format markdown', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        target: 'all',
        cleared: { logs: 10, history: 5, errors: 2 },
        totalCleared: 17,
      })

      const tool = registeredTools['nestjs_clear_buffers']
      const result = await tool.handler({ target: 'all' })

      expect(proxy.callPluginTool).toHaveBeenCalledWith(3000, 'clear_buffers', { target: 'all' })
      expect(result.content[0].text).toContain('NestJS Buffers Purged Successfully')
      expect(result.content[0].text).toContain('17')
      expect(result.structuredContent.totalCleared).toBe(17)
    })
  })

  describe('nestjs_diagnose_health', () => {
    it('should register tool with readOnly annotations', () => {
      const tool = registeredTools['nestjs_diagnose_health']
      expect(tool).toBeDefined()
      expect(tool.annotations.readOnlyHint).toBe(true)
      expect(tool.annotations.destructiveHint).toBe(false)
    })

    it('should aggregate metrics into rich markdown', async () => {
      jest.spyOn(proxy, 'resolvePort').mockResolvedValue(3000)
      jest.spyOn(proxy, 'callPluginTool').mockResolvedValue({
        server: { name: 'my-nest-app', uptime: 120, pid: 1234, nodeVersion: 'v22.0.0' },
        routes: { total: 15 },
        traffic: {
          sampleSize: 50,
          distribution: { '2xx': 45, '3xx': 0, '4xx': 3, '5xx': 2 },
          errorRate: '10.0%',
          slowestRequest: { method: 'POST', path: '/checkout', durationMs: 450, statusCode: 500 },
        },
        errors: {
          totalInBuffer: 2,
          unhandledCount: 1,
          recent: [
            {
              id: 'err-1',
              timestamp: Date.now(),
              source: 'http-5xx',
              name: 'DatabaseError',
              message: 'Connection timed out',
              stack: 'Error: Connection timed out\n  at db.connect()',
              context: 'OrderService',
              requestId: 'req-999',
              correlatedLogs: [{ timestamp: Date.now(), level: 'error', message: 'DB down' }],
            },
          ],
        },
      })

      const tool = registeredTools['nestjs_diagnose_health']
      const mdResult = await tool.handler({ response_format: ResponseFormat.MARKDOWN })

      expect(mdResult.content[0].text).toContain('Health & Diagnostics Report')
      expect(mdResult.content[0].text).toContain('my-nest-app')
      expect(mdResult.content[0].text).toContain('Total Endpoints:** **15**')
      expect(mdResult.content[0].text).toContain('Correlated Request Logs')
      expect(mdResult.content[0].text).toContain('DB down')

      // Test JSON format
      const jsonResult = await tool.handler({ response_format: ResponseFormat.JSON })
      const parsed = JSON.parse(jsonResult.content[0].text)
      expect(parsed.server.name).toBe('my-nest-app')
      expect(parsed.routes.total).toBe(15)
    })
  })
})
