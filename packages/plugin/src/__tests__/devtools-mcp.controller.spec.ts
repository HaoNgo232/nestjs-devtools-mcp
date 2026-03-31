import { NotFoundException } from '@nestjs/common'
import { DevtoolsMcpController } from '../devtools-mcp.controller'
import { DevtoolsCollector, CollectorResult } from '../collectors/collector.interface'
import { DevtoolsMcpOptions } from '../devtools-mcp.options'

/**
 * Unit tests for the refactored DevtoolsMcpController.
 * Verifies generic dispatch mechanism and health endpoint contract conformance.
 */
describe('DevtoolsMcpController', () => {
  let controller: DevtoolsMcpController
  let mockCollectors: DevtoolsCollector[]
  const defaultOptions: DevtoolsMcpOptions = { endpoint: '/_dev/mcp', logBufferSize: 500 }

  beforeEach(() => {
    mockCollectors = [
      {
        toolName: 'get_logs',
        description: 'Get logs',
        execute: jest.fn().mockResolvedValue({
          toolName: 'get_logs',
          data: { entries: [], total: 0, bufferSize: 500 },
        } satisfies CollectorResult),
      },
      {
        toolName: 'get_routes',
        description: 'Get routes',
        execute: jest.fn().mockResolvedValue({
          toolName: 'get_routes',
          data: { routes: [] },
        } satisfies CollectorResult),
      },
    ]

    controller = new DevtoolsMcpController(defaultOptions, mockCollectors)
  })

  // ── Health Endpoint ───────────────────────────────────────

  describe('getHealth()', () => {
    it('should return status "ok" conforming to McpHealthResponse', () => {
      const health = controller.getHealth()

      expect(health.status).toBe('ok')
      expect(health.module).toBe('nestjs-devtools-mcp')
      expect(health.name).toBe('nestjs-devtools-mcp')
      expect(typeof health.timestamp).toBe('string')
      expect(typeof health.pid).toBe('number')
      expect(typeof health.uptime).toBe('number')
    })

    it('should list all registered tool names', () => {
      const health = controller.getHealth()

      expect(health.tools).toEqual(['get_logs', 'get_routes'])
    })

    it('should return empty tools array when no collectors registered', () => {
      const emptyController = new DevtoolsMcpController(defaultOptions, [])
      const health = emptyController.getHealth()

      expect(health.tools).toEqual([])
    })

    it('should return a valid ISO timestamp', () => {
      const health = controller.getHealth()
      const parsed = Date.parse(health.timestamp)

      expect(Number.isNaN(parsed)).toBe(false)
    })
  })

  // ── Tool Dispatch ─────────────────────────────────────────

  describe('handleTool()', () => {
    it('should dispatch to the correct collector by toolName', async () => {
      await controller.handleTool('get_logs', { lines: 10 })

      expect(mockCollectors[0].execute).toHaveBeenCalledWith({ lines: 10 })
      expect(mockCollectors[1].execute).not.toHaveBeenCalled()
    })

    it('should dispatch to second collector when matching toolName', async () => {
      await controller.handleTool('get_routes', {})

      expect(
        (mockCollectors[0] as unknown as any).not_existent_but_mocked_anyway_mockCollectors_0_execute ? '' : '',
      ).toBe('') // manual check
      expect(mockCollectors[0].execute).not.toHaveBeenCalled()
      expect(mockCollectors[1].execute).toHaveBeenCalledWith({})
    })

    it('should return collector result data (unwrapped from CollectorResult)', async () => {
      const result = await controller.handleTool('get_logs', {})

      // Controller returns result.data, NOT the full CollectorResult
      expect(result).toEqual({ entries: [], total: 0, bufferSize: 500 })
    })

    it('should throw NotFoundException for unknown tool', async () => {
      await expect(controller.handleTool('non_existent_tool', {})).rejects.toThrow(NotFoundException)
    })

    it('should throw NotFoundException when collectors array is empty', async () => {
      const emptyController = new DevtoolsMcpController(defaultOptions, [])

      await expect(emptyController.handleTool('get_logs', {})).rejects.toThrow(NotFoundException)
    })

    it('should pass the full body object to collector.execute()', async () => {
      const complexBody = { lines: 20, level: 'error', extra: 'field' }
      await controller.handleTool('get_logs', complexBody)

      expect(mockCollectors[0].execute).toHaveBeenCalledWith(complexBody)
    })
  })

  // ── Edge cases for collectors input ──────────────────────────

  describe('with a single collector (not an array)', () => {
    it('should still work correctly in health check (covering non-array branch)', () => {
      const singleCollector = mockCollectors[0]
      const ctrl = new DevtoolsMcpController(defaultOptions, singleCollector as unknown as DevtoolsCollector[])
      const health = ctrl.getHealth()
      expect(health.tools).toEqual(['get_logs'])
    })

    it('should still work correctly in handleTool (covering non-array branch)', async () => {
      const singleCollector = mockCollectors[0]
      const ctrl = new DevtoolsMcpController(defaultOptions, singleCollector as unknown as DevtoolsCollector[])
      const result = await ctrl.handleTool('get_logs', {})
      expect(result).toEqual({ entries: [], total: 0, bufferSize: 500 })
    })
  })
})
