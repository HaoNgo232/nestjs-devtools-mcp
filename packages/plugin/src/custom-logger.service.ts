import { Injectable, ConsoleLogger, LoggerService } from '@nestjs/common'
import { LogBufferService } from './log-buffer.service'

/**
 * CustomLoggerService replaces the default NestJS Logger to:
 * 1. Collect logs into LogBufferService for MCP observation.
 * 2. Forward these logs to Console to ensure the terminal displays as usual.
 */
@Injectable()
export class CustomLoggerService extends ConsoleLogger implements LoggerService {
  constructor(
    private readonly bufferService: LogBufferService,
    context?: string,
  ) {
    super(context || 'App')
  }

  /**
   * Override the standard NestJS log method to simultaneously write to buffer and console
   */
  override log(message: unknown, context?: string) {
    this.bufferService.add({
      level: 'log',
      message: this.formatMyMessage(message),
      context: context || this.context,
    })
    super.log(message, context || '')
  }

  /**
   * Override the standard NestJS error method
   */
  override error(message: unknown, trace?: string, context?: string) {
    this.bufferService.add({
      level: 'error',
      message: this.formatMyMessage(message),
      context: context || this.context,
      trace,
    })
    super.error(message, trace || '', context || '')
  }

  /**
   * Override the standard NestJS warn method
   */
  override warn(message: unknown, context?: string) {
    this.bufferService.add({
      level: 'warn',
      message: this.formatMyMessage(message),
      context: context || this.context,
    })
    super.warn(message, context || '')
  }

  /**
   * Override the standard NestJS debug method
   */
  override debug(message: unknown, context?: string) {
    this.bufferService.add({
      level: 'debug',
      message: this.formatMyMessage(message),
      context: context || this.context,
    })
    super.debug(message, context || '')
  }

  /**
   * Override the standard NestJS verbose method
   */
  override verbose(message: unknown, context?: string) {
    this.bufferService.add({
      level: 'verbose',
      message: this.formatMyMessage(message),
      context: context || this.context,
    })
    super.verbose(message, context || '')
  }

  /**
   * Support re-formatting the message if it is an object instead of a string
   */
  private formatMyMessage(message: unknown): string {
    if (typeof message === 'object') {
      try {
        return JSON.stringify(message)
      } catch {
        return String(message)
      }
    }
    return String(message)
  }
}
