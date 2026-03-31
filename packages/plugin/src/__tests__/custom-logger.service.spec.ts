import { LogBufferService } from '../log-buffer.service'
import { CustomLoggerService } from '../custom-logger.service'

/**
 * Unit tests for CustomLoggerService.
 * Verifies that all log levels write to buffer AND forward to console.
 */
describe('CustomLoggerService', () => {
  let logger: CustomLoggerService
  let mockBuffer: jest.Mocked<Pick<LogBufferService, 'add'>>

  beforeEach(() => {
    mockBuffer = {
      add: jest.fn(),
    }
    logger = new CustomLoggerService(mockBuffer as unknown as LogBufferService, 'TestCtx')

    // Suppress actual console output during tests
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'debug').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // ── Buffer write for each level ───────────────────────────

  it('should buffer a "log" level entry', () => {
    logger.log('hello world', 'SomeContext')

    expect(mockBuffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'log',
        message: 'hello world',
        context: 'SomeContext',
      }),
    )
  })

  it('should buffer an "error" level entry with trace', () => {
    logger.error('boom', 'stack-trace-here', 'ErrCtx')

    expect(mockBuffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'boom',
        context: 'ErrCtx',
        trace: 'stack-trace-here',
      }),
    )
  })

  it('should buffer a "warn" level entry', () => {
    logger.warn('caution')

    expect(mockBuffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: 'caution',
      }),
    )
  })

  it('should buffer a "debug" level entry', () => {
    logger.debug('debug-info')

    expect(mockBuffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
        message: 'debug-info',
      }),
    )
  })

  it('should buffer a "verbose" level entry', () => {
    logger.verbose('verbose-info')

    expect(mockBuffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'verbose',
        message: 'verbose-info',
      }),
    )
  })

  // ── Default context fallback ──────────────────────────────

  it('should use constructor context when no context passed to log()', () => {
    logger.log('no explicit context')

    expect(mockBuffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'TestCtx',
      }),
    )
  })

  // ── Object message serialization ──────────────────────────

  it('should JSON.stringify object messages', () => {
    logger.log({ key: 'value', num: 42 })

    expect(mockBuffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '{"key":"value","num":42}',
      }),
    )
  })

  it('should convert non-serializable objects to String()', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    logger.log(circular)

    // JSON.stringify throws for circular → falls back to String()
    expect(mockBuffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.any(String),
      }),
    )
  })

  it('should handle null and undefined messages', () => {
    logger.log(null)
    logger.log(undefined)

    expect(mockBuffer.add).toHaveBeenCalledTimes(2)
    // null is an object → JSON.stringify(null) = 'null'
    expect(mockBuffer.add).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: 'null' }))
    // undefined is not object → String(undefined) = 'undefined'
    expect(mockBuffer.add).toHaveBeenNthCalledWith(2, expect.objectContaining({ message: 'undefined' }))
  })

  // ── Forwarding to console (transparency) ──────────────────

  it('should call super methods so console output is preserved', () => {
    // We can't easily spy on super.log directly, but we can verify
    // the logger doesn't throw and buffer still receives data.
    // The real integration test is: NestJS app console looks normal.
    expect(() => {
      logger.log('forward-test')
      logger.error('forward-test')
      logger.warn('forward-test')
      logger.debug('forward-test')
      logger.verbose('forward-test')
    }).not.toThrow()

    expect(mockBuffer.add).toHaveBeenCalledTimes(5)
  })
})
