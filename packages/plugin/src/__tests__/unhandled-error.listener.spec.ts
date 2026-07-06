import { UnhandledErrorListener } from '../unhandled-error.listener'
import { ErrorBufferService } from '../error-buffer.service'

describe('UnhandledErrorListener', () => {
  let buffer: jest.Mocked<Pick<ErrorBufferService, 'add'>>
  let listener: UnhandledErrorListener
  let originalListeners: NodeJS.UncaughtExceptionListener[]
  let originalMonitorListeners: NodeJS.UncaughtExceptionListener[]
  let originalRejectionListeners: NodeJS.UnhandledRejectionListener[]

  beforeEach(() => {
    buffer = { add: jest.fn().mockReturnValue({ id: 'uuid', timestamp: 0 }) as any }
    listener = new UnhandledErrorListener(buffer as any)

    // Save existing listeners to restore after test
    originalListeners = process.listeners('uncaughtException')
    originalMonitorListeners = process.listeners('uncaughtExceptionMonitor' as any)
    originalRejectionListeners = process.listeners('unhandledRejection')
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('uncaughtExceptionMonitor' as any)
    process.removeAllListeners('unhandledRejection')
  })

  afterEach(() => {
    listener.detach()
    // Restore original listeners
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('uncaughtExceptionMonitor' as any)
    process.removeAllListeners('unhandledRejection')
    originalListeners.forEach((l) => process.on('uncaughtException', l))
    originalMonitorListeners.forEach((l) => process.on('uncaughtExceptionMonitor' as any, l))
    originalRejectionListeners.forEach((l) => process.on('unhandledRejection', l))
  })

  describe('attach', () => {
    it('registers uncaughtExceptionMonitor instead of uncaughtException to avoid changing crash semantics', () => {
      listener.attach()

      expect(process.listenerCount('uncaughtExceptionMonitor')).toBeGreaterThan(0)
      expect(process.listenerCount('uncaughtException')).toBe(0)
      expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0)
    })

    it('does not register duplicate listeners on double attach', () => {
      listener.attach()
      const countAfterFirst = process.listenerCount('uncaughtExceptionMonitor')
      listener.attach()
      expect(process.listenerCount('uncaughtExceptionMonitor')).toBe(countAfterFirst)
    })

    it('is idempotent when attach then detach then attach again', () => {
      listener.attach()
      listener.detach()
      listener.attach()
      expect(process.listenerCount('uncaughtExceptionMonitor')).toBeGreaterThan(0)
    })
  })

  describe('capture', () => {
    it('captures uncaughtExceptionMonitor into buffer with source "unhandled"', () => {
      listener.attach()
      const err = new Error('fatal-monitor-error')
      process.emit('uncaughtExceptionMonitor' as any, err, 'uncaughtException')
      expect(buffer.add).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'unhandled',
          name: 'Error',
          message: 'fatal-monitor-error',
          stack: err.stack,
        }),
      )
    })

    it('captures unhandledRejection into buffer with source "unhandled"', () => {
      listener.attach()
      const err = new Error('boom-rejection')
      process.emit('unhandledRejection', err, Promise.resolve())
      expect(buffer.add).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'unhandled',
          message: 'boom-rejection',
        }),
      )
    })

    it('serializes non-Error thrown values (string, primitive)', () => {
      listener.attach()
      process.emit('uncaughtExceptionMonitor' as any, 'string-error' as any, 'uncaughtException')
      expect(buffer.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Error',
          message: 'string-error',
          stack: null,
        }),
      )
    })

    it('does NOT swallow the error — re-throw is host app responsibility', () => {
      listener.attach()
      // Listener should not throw — it just records
      expect(() => process.emit('uncaughtExceptionMonitor' as any, new Error('x'), 'uncaughtException')).not.toThrow()
    })

    it('catches its own buffer.add errors silently (never crash host)', () => {
      buffer.add.mockImplementation(() => {
        throw new Error('buffer broken')
      })
      listener.attach()
      expect(() => process.emit('uncaughtExceptionMonitor' as any, new Error('x'), 'uncaughtException')).not.toThrow()
    })
  })

  describe('captureBootstrapError (explicit API)', () => {
    it('records a bootstrap error with source "bootstrap"', () => {
      const err = new Error('NestFactory create failed')
      listener.captureBootstrapError(err, 'AppModule')
      expect(buffer.add).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'bootstrap',
          message: 'NestFactory create failed',
          context: 'AppModule',
        }),
      )
    })

    it('attaches automatically when captureBootstrapError is called before attach()', () => {
      // Use case: bootstrap error happens before listener.attach()
      listener.captureBootstrapError(new Error('early'), 'Bootstrap')
      expect(buffer.add).toHaveBeenCalled()
    })
  })

  describe('detach', () => {
    it('detach removes its own uncaughtExceptionMonitor listener', () => {
      listener.attach()
      expect(process.listenerCount('uncaughtExceptionMonitor')).toBeGreaterThan(0)
      listener.detach()
      expect(process.listenerCount('uncaughtExceptionMonitor')).toBe(0)
    })

    it('does not remove or interfere with host uncaughtException listeners', () => {
      const hostListener = jest.fn()
      process.on('uncaughtException', hostListener)

      listener.attach()
      listener.detach()

      expect(process.listeners('uncaughtException')).toContain(hostListener)

      process.removeListener('uncaughtException', hostListener)
    })

    it('is safe to call detach without prior attach', () => {
      expect(() => listener.detach()).not.toThrow()
    })
  })
})
