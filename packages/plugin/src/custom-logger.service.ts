import { Injectable, ConsoleLogger, LoggerService } from '@nestjs/common';
import { LogBufferService } from './log-buffer.service';

/**
 * CustomLoggerService này thay thế Logger mặc định của NestJS nhằm:
 * 1. Thu thập log vào LogBufferService phục vụ cho việc quan sát từ MCP.
 * 2. Forward các log này ra Console để đảm bảo terminal vẫn hiển thị như bình thường.
 */
@Injectable()
export class CustomLoggerService extends ConsoleLogger implements LoggerService {
  constructor(
    private readonly bufferService: LogBufferService,
    context?: string,
  ) {
    super(context || 'App');
  }

  /**
   * Override hàm log chuẩn của NestJS để đồng thời ghi vào buffer và console
   */
  override log(message: unknown, context?: string) {
    this.bufferService.add({
      level: 'log',
      message: this.formatMyMessage(message),
      context: context || this.context,
    });
    super.log(message, context || '');
  }

  /**
   * Override hàm error chuẩn của NestJS
   */
  override error(message: unknown, trace?: string, context?: string) {
    this.bufferService.add({
      level: 'error',
      message: this.formatMyMessage(message),
      context: context || this.context,
      trace,
    });
    super.error(message, trace || '', context || '');
  }

  /**
   * Override hàm warn chuẩn của NestJS
   */
  override warn(message: unknown, context?: string) {
    this.bufferService.add({
      level: 'warn',
      message: this.formatMyMessage(message),
      context: context || this.context,
    });
    super.warn(message, context || '');
  }

  /**
   * Override hàm debug chuẩn của NestJS
   */
  override debug(message: unknown, context?: string) {
    this.bufferService.add({
      level: 'debug',
      message: this.formatMyMessage(message),
      context: context || this.context,
    });
    super.debug(message, context || '');
  }

  /**
   * Override hàm verbose chuẩn của NestJS
   */
  override verbose(message: unknown, context?: string) {
    this.bufferService.add({
      level: 'verbose',
      message: this.formatMyMessage(message),
      context: context || this.context,
    });
    super.verbose(message, context || '');
  }

  /**
   * Hỗ trợ định dạng lại message nếu nó là object thay vì string
   */
  private formatMyMessage(message: unknown): string {
    if (typeof message === 'object') {
      try {
        return JSON.stringify(message);
      } catch {
        return String(message);
      }
    }
    return String(message);
  }
}
