import { Test, TestingModule } from '@nestjs/testing'
import { DevtoolsMcpModule } from '../devtools-mcp.module'
import { LogBufferService } from '../log-buffer.service'
import { CustomLoggerService } from '../custom-logger.service'
import { DEVTOOLS_COLLECTORS } from '../collectors/collector.interface'
import { DevtoolsMcpController } from '../devtools-mcp.controller'

/**
 * Integration tests for DevtoolsMcpModule DI wiring.
 * Verifies that the multi-provider pattern works correctly
 * and all components receive their dependencies.
 */
describe('DevtoolsMcpModule (Integration)', () => {
  // ── Active mode (non-production) ──────────────────────────

  describe('when enabled (non-production)', () => {
    let module: TestingModule

    beforeEach(async () => {
      // Ensure NODE_ENV is not production for this test
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      module = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register()],
      }).compile()

      process.env.NODE_ENV = originalEnv
    })

    it('should provide LogBufferService', () => {
      const service = module.get<LogBufferService>(LogBufferService)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(LogBufferService)
    })

    it('should provide CustomLoggerService', () => {
      const service = module.get<CustomLoggerService>(CustomLoggerService)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(CustomLoggerService)
    })

    it('should provide DEVTOOLS_COLLECTORS', () => {
      const collectors = module.get<unknown>(DEVTOOLS_COLLECTORS)
      expect(collectors).toBeDefined()
    })

    it('should include LogCollector in the collectors array with toolName "get_logs"', () => {
      const collectors = module.get<unknown>(DEVTOOLS_COLLECTORS)
      const logCollector = Array.isArray(collectors)
        ? collectors.find((c: Record<string, unknown>) => (c as any).toolName === 'get_logs')
        : (collectors as any)?.toolName === 'get_logs'
          ? collectors
          : undefined

      expect(logCollector).toBeDefined()
      expect((logCollector as any)?.description).toBeTruthy()
    })

    it('should register DevtoolsMcpController', () => {
      const ctrl = module.get<DevtoolsMcpController>(DevtoolsMcpController)
      expect(ctrl).toBeDefined()
    })

    it('should wire LogBufferService into the log collector (shared instance)', () => {
      const bufferService = module.get<LogBufferService>(LogBufferService)

      // Add a log via the shared buffer
      bufferService.add({ level: 'log', message: 'integration-test' })

      // Retrieve via collector
      const collectors = module.get<unknown>(DEVTOOLS_COLLECTORS)
      const logCollector = Array.isArray(collectors)
        ? collectors.find((c: Record<string, unknown>) => (c as any).toolName === 'get_logs')
        : (collectors as any)?.toolName === 'get_logs'
          ? collectors
          : undefined

      if (!logCollector) {
        throw new Error('LogCollector not found')
      }

      // This validates that the collector's LogBufferService is the same singleton
      return Promise.resolve((logCollector as any).execute({})).then((result: any) => {
        const data = result.data as { entries: Array<{ message: string }> }
        const found = data.entries.some((e) => e.message === 'integration-test')
        expect(found).toBe(true)
      })
    })
  })

  // ── Disabled mode (production) ────────────────────────────

  describe('when disabled (production)', () => {
    it('should return an empty module without providers or controllers', async () => {
      const module = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register({ disabled: true })],
      }).compile()

      // LogBufferService should NOT be registered
      expect(() => module.get(LogBufferService)).toThrow()
    })

    it('should auto-disable when NODE_ENV is "production"', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      try {
        const module = await Test.createTestingModule({
          imports: [DevtoolsMcpModule.register()],
        }).compile()

        expect(() => module.get(LogBufferService)).toThrow()
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })
  })

  // ── Custom options ────────────────────────────────────────

  describe('with custom options', () => {
    it('should respect custom logBufferSize', async () => {
      const module = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register({ logBufferSize: 3 })],
      }).compile()

      const buffer = module.get<LogBufferService>(LogBufferService)

      // Fill beyond capacity
      buffer.add({ level: 'log', message: '1' })
      buffer.add({ level: 'log', message: '2' })
      buffer.add({ level: 'log', message: '3' })
      buffer.add({ level: 'log', message: '4' })

      const logs = buffer.getLogs(100)
      expect(logs.length).toBe(3)
      expect(logs[0].message).toBe('2') // '1' was evicted
    })
  })
})
