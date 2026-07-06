import { Test, TestingModule } from '@nestjs/testing'
import { DevtoolsMcpModule } from '../devtools-mcp.module'
import { LogBufferService } from '../log-buffer.service'
import { ErrorBufferService } from '../error-buffer.service'
import { UnhandledErrorListener } from '../unhandled-error.listener'
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

    it('should provide ErrorBufferService', () => {
      const service = module.get(ErrorBufferService)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(ErrorBufferService)
    })

    it('should provide UnhandledErrorListener', () => {
      const listener = module.get(UnhandledErrorListener)
      expect(listener).toBeDefined()
      expect(listener).toBeInstanceOf(UnhandledErrorListener)
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

    it('should include all 5 enabled collectors in the collectors array', () => {
      const controller = module.get<DevtoolsMcpController>(DevtoolsMcpController)
      const collectors = (controller as any).collectors
      expect(Array.isArray(collectors)).toBe(true)
      expect(collectors.length).toBe(5)

      const logCollector = (collectors as any[]).find((c) => c.toolName === 'get_logs')
      const routeCollector = (collectors as any[]).find((c) => c.toolName === 'get_routes')
      const requestHistoryCollector = (collectors as any[]).find((c) => c.toolName === 'get_request_history')
      const configCollector = (collectors as any[]).find((c) => c.toolName === 'get_config')
      const errorCollector = (collectors as any[]).find((c) => c.toolName === 'get_errors')

      expect(logCollector).toBeDefined()
      expect(logCollector.description).toBeTruthy()
      expect(routeCollector).toBeDefined()
      expect(routeCollector.description).toBeTruthy()
      expect(requestHistoryCollector).toBeDefined()
      expect(requestHistoryCollector.description).toBeTruthy()
      expect(configCollector).toBeDefined()
      expect(configCollector.description).toBeTruthy()
      expect(errorCollector).toBeDefined()
      expect(errorCollector.description).toBeTruthy()
    })

    it('should expose get_errors in health endpoint tools list', () => {
      const controller = module.get(DevtoolsMcpController)
      const health = controller.getHealth()
      expect(health.tools).toContain('get_errors')
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

  describe('Auto-apply logger', () => {
    it('auto-registers CustomLoggerService as app logger on bootstrap', async () => {
      const useLoggerSpy = jest.fn()
      const moduleFixture = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register()],
      }).compile()
      const app = moduleFixture.createNestApplication({ bufferLogs: true })
      app.useLogger = useLoggerSpy
      await app.init()

      expect(useLoggerSpy).toHaveBeenCalledWith(expect.any(CustomLoggerService))
      await app.close()
    })

    it('emits a console.warn at bootstrap if useLogger was not applied within 100ms', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const originalApplied = (DevtoolsMcpModule as any).loggerApplied
      ;(DevtoolsMcpModule as any).loggerApplied = false

      const moduleFixture = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register()],
      }).compile()
      const app = moduleFixture.createNestApplication()
      jest.spyOn(app, 'get').mockImplementation((token: any) => {
        if (token === CustomLoggerService) {
          throw new Error('Not found')
        }
        return moduleFixture.get(token)
      })

      await app.init()

      await new Promise((r) => setTimeout(r, 150))
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DevtoolsMcp] CustomLoggerService was not automatically applied'),
      )

      warnSpy.mockRestore()
      ;(DevtoolsMcpModule as any).loggerApplied = originalApplied
      await app.close()
    })

    it('does NOT auto-apply when options.disabled is true', async () => {
      const module = await Test.createTestingModule({
        imports: [DevtoolsMcpModule.register({ disabled: true })],
      }).compile()
      // Verify no CustomLoggerService is bound
      expect(() => module.get(CustomLoggerService)).toThrow()
    })
  })
})
