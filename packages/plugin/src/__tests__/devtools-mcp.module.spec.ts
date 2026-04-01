import { Test, TestingModule } from '@nestjs/testing'
import { DevtoolsMcpModule } from '../devtools-mcp.module'
import { LogBufferService } from '../log-buffer.service'
import { CustomLoggerService } from '../custom-logger.service'
import { DEVTOOLS_COLLECTORS } from '../collectors/collector.interface'
import { DevtoolsMcpController } from '../devtools-mcp.controller'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from '../devtools-mcp.options'
import * as fs from 'fs'
import * as path from 'path'

jest.mock('fs')
jest.mock('path', () => {
  const original = jest.requireActual('path')
  return {
    ...original,
    basename: jest.fn().mockImplementation(original.basename),
  }
})

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

    it('should include LogCollector and RouteCollector in the collectors array', () => {
      const controller = module.get<DevtoolsMcpController>(DevtoolsMcpController)
      const collectors = (controller as any).collectors
      expect(Array.isArray(collectors)).toBe(true)
      expect(collectors.length).toBe(2)

      const logCollector = (collectors as any[]).find((c) => c.toolName === 'get_logs')
      const routeCollector = (collectors as any[]).find((c) => c.toolName === 'get_routes')

      expect(logCollector).toBeDefined()
      expect(logCollector.description).toBeTruthy()
      expect(routeCollector).toBeDefined()
      expect(routeCollector.description).toBeTruthy()
    })

    it('should register DevtoolsMcpController', () => {
      const ctrl = module.get<DevtoolsMcpController>(DevtoolsMcpController)
      expect(ctrl).toBeDefined()
    })

    it('should wire LogBufferService into the log collector (shared instance)', () => {
      const bufferService = module.get<LogBufferService>(LogBufferService)

      // Add a log via the shared buffer
      bufferService.add({ level: 'log', message: 'integration-test' })

      // Retrieve via collector through controller
      const controller = module.get<DevtoolsMcpController>(DevtoolsMcpController)
      const collectors = (controller as any).collectors
      const logCollector = (collectors as any[]).find((c) => c.toolName === 'get_logs')

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

  // ── Project name auto-detection ──────────────────────────

  describe('Project name auto-detection', () => {
    const mockExistsSync = fs.existsSync as jest.Mock
    const mockReadFileSync = fs.readFileSync as jest.Mock

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should use name from package.json if it exists', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'test-app' }))

      const module = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register()],
      }).compile()

      const options = module.get<DevtoolsMcpOptions>(DEVTOOLS_OPTIONS_TOKEN)
      expect(options.name).toBe('test-app') // Lấy từ package.json - Taken from package.json
    })

    it('should fallback to directory name if package.json is missing', async () => {
      mockExistsSync.mockReturnValue(false)

      const module = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register()],
      }).compile()

      const options = module.get<DevtoolsMcpOptions>(DEVTOOLS_OPTIONS_TOKEN)
      // basename of process.cwd() will depend on where the test runs.
      // But we know it will NOT be the hardcoded 'test-app'.
      expect(options.name).toBeDefined()
      expect(options.name).not.toBe('test-app')
    })

    it('should respect explicit name in options over auto-detection', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'should-be-ignored' }))

      const module = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register({ name: 'explicit-name' })],
      }).compile()

      const options = module.get<DevtoolsMcpOptions>(DEVTOOLS_OPTIONS_TOKEN)
      expect(options.name).toBe('explicit-name') // Ưu tiên cấu hình thủ công - Manual override takes priority
    })

    it('should fallback to hardcoded default if path.basename throws', async () => {
      const spy = (path.basename as jest.Mock).mockImplementationOnce(() => {
        throw new Error('path error')
      })
      mockExistsSync.mockReturnValue(false)

      const module = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register()],
      }).compile()

      const options = module.get<DevtoolsMcpOptions>(DEVTOOLS_OPTIONS_TOKEN)
      expect(options.name).toBe('nestjs-devtools-mcp') // Fallback cứng khi path lỗi - Hardcoded fallback on path error
    })
  })
})
