import { UnhandledErrorListener } from '../unhandled-error.listener'
import { ErrorBufferService } from '../error-buffer.service'

describe('UnhandledErrorListener', () => {
  let buffer: jest.Mocked<Pick<ErrorBufferService, 'add'>>
  let listener: UnhandledErrorListener
  let originalListeners: NodeJS.UncaughtExceptionListener[]
  let originalRejectionListeners: NodeJS.UnhandledRejectionListener[]

  beforeEach(() => {
    buffer = { add: jest.fn().mockReturnValue({ id: 'uuid', timestamp: 0 }) as any }
    listener = new UnhandledErrorListener(buffer as any)

    // Save existing listeners to restore after test
    originalListeners = process.listeners('uncaughtException')
    originalRejectionListeners = process.listeners('unhandledRejection')
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')
  })

  afterEach(() => {
    listener.detach()
    // Restore original listeners
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')
    originalListeners.forEach((l) => process.on('uncaughtException', l))
    originalRejectionListeners.forEach((l) => process.on('unhandledRejection', l))
  })

  describe('attach', () => {
    it('registers uncaughtException and unhandledRejection listeners on process', () => {
      listener.attach()
      expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0)
      expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0)
    })

    it('does not register duplicate listeners on double attach', () => {
      listener.attach()
      const countAfterFirst = process.listenerCount('uncaughtException')
      listener.attach()
      expect(process.listenerCount('uncaughtException')).toBe(countAfterFirst)
    })

    it('is idempotent when attach then detach then attach again', () => {
      listener.attach()
      listener.detach()
      listener.attach()
      expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0)
    })
  })

  describe('capture', () => {
    it('captures uncaughtException into buffer with source "unhandled"', () => {
      listener.attach()
      const err = new Error('boom-uncaught')
      process.emit('uncaughtException', err)
      expect(buffer.add).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'unhandled',
          name: 'Error',
          message: 'boom-uncaught',
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
      process.emit('uncaughtException', 'string-error' as any)
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
      expect(() => process.emit('uncaughtException', new Error('x'))).not.toThrow()
    })

    it('catches its own buffer.add errors silently (never crash host)', () => {
      buffer.add.mockImplementation(() => {
        throw new Error('buffer broken')
      })
      listener.attach()
      expect(() => process.emit('uncaughtException', new Error('x'))).not.toThrow()
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
    it('removes its own listeners but preserves host app listeners', () => {
      const hostListener = jest.fn()
      process.on('uncaughtException', hostListener)
      listener.attach()
      listener.detach()
      expect(process.listenerCount('uncaughtException')).toBe(1) // only hostListener remains
      expect(process.listeners('uncaughtException')).toContain(hostListener)
    })

    it('is safe to call detach without prior attach', () => {
      expect(() => listener.detach()).not.toThrow()
    })
  })
})
