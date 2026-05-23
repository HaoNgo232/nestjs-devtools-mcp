import { INestApplicationContext } from '@nestjs/common'
import { CustomLoggerService } from '../custom-logger.service'
import { applyDevtoolsLogger } from '../devtools-mcp.utils'

describe('DevtoolsMcpUtils (applyDevtoolsLogger)', () => {
  let mockApp: jest.Mocked<Partial<INestApplicationContext>>
  let mockLogger: jest.Mocked<Partial<CustomLoggerService>>

  beforeEach(() => {
    mockLogger = { log: jest.fn() }
    mockApp = {
      get: jest.fn().mockReturnValue(mockLogger),
      useLogger: jest.fn(),
    }
  })

  it('should successfully apply the custom logger to the app context and print a deprecation warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    applyDevtoolsLogger(mockApp as INestApplicationContext)

    expect(mockApp.get).toHaveBeenCalledWith(CustomLoggerService)
    expect(mockApp.useLogger).toHaveBeenCalledWith(mockLogger)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DevtoolsMcp] applyDevtoolsLogger() is no longer required — auto-applied since v0.3.0'),
    )
    warnSpy.mockRestore()
  })

  it('should not throw error on double registration', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    applyDevtoolsLogger(mockApp as INestApplicationContext)
    applyDevtoolsLogger(mockApp as INestApplicationContext)

    expect(mockApp.get).toHaveBeenCalledTimes(2)
    expect(mockApp.useLogger).toHaveBeenCalledTimes(2)
    warnSpy.mockRestore()
  })

  it('should catch and log an error if CustomLoggerService is not available', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    ;(mockApp.get as jest.Mock).mockImplementation(() => {
      throw new Error('Module not registered')
    })

    applyDevtoolsLogger(mockApp as INestApplicationContext)

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DevtoolsMcp] Unable to activate Logger automatically'),
      expect.any(Error),
    )
    expect(mockApp.useLogger).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
    warnSpy.mockRestore()
  })
})
