import { Injectable } from '@nestjs/common'
import { ErrorBufferService } from './error-buffer.service'

@Injectable()
export class UnhandledErrorListener {
  private attached = false
  private uncaughtMonitorHandler?: (err: unknown) => void
  private rejectionHandler?: (reason: unknown, promise: Promise<unknown>) => void

  constructor(private readonly buffer: ErrorBufferService) {}

  attach(): void {
    if (this.attached) return
    this.attached = true

    this.uncaughtMonitorHandler = (err: unknown) => this.record(err, 'unhandled', null)
    this.rejectionHandler = (reason: unknown) => this.record(reason, 'unhandled', null)

    process.on('uncaughtExceptionMonitor', this.uncaughtMonitorHandler as NodeJS.UncaughtExceptionListener)
    process.on('unhandledRejection', this.rejectionHandler)
  }

  detach(): void {
    if (!this.attached) return
    this.attached = false
    if (this.uncaughtMonitorHandler) {
      process.removeListener(
        'uncaughtExceptionMonitor',
        this.uncaughtMonitorHandler as NodeJS.UncaughtExceptionListener,
      )
    }
    if (this.rejectionHandler) process.removeListener('unhandledRejection', this.rejectionHandler)
    this.uncaughtMonitorHandler = undefined
    this.rejectionHandler = undefined
  }

  captureBootstrapError(error: unknown, context: string | null): void {
    this.record(error, 'bootstrap', context)
  }

  private record(error: unknown, source: 'unhandled' | 'bootstrap', context: string | null): void {
    try {
      const serialized = this.serialize(error)
      this.buffer.add({
        source,
        name: serialized.name,
        message: serialized.message,
        stack: serialized.stack,
        context,
        requestId: null,
        relatedLogTimestamp: null,
      })
    } catch {
      // Must never crash host app
    }
  }

  private serialize(error: unknown): { name: string; message: string; stack: string | null } {
    if (error instanceof Error) {
      return { name: error.name || 'Error', message: error.message, stack: error.stack || null }
    }
    return { name: 'Error', message: String(error), stack: null }
  }
}
