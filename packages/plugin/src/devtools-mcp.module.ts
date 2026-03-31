import { Module, DynamicModule, Global, Logger } from '@nestjs/common';
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options';
import { LogBufferService } from './log-buffer.service';
import { CustomLoggerService } from './custom-logger.service';
import { DevtoolsMcpController } from './devtools-mcp.controller';

/**
 * DevtoolsMcpModule được thiết kế để nhúng vào NestJS App.
 * Cung cấp khả năng giao tiếp thời gian thực cho các MCP Agent thông qua Bridge.
 */
@Global()
@Module({})
export class DevtoolsMcpModule {
  private static readonly logger = new Logger('DevtoolsMcp');

  /**
   * Phương thức đăng ký module động, cho phép cấu hình linh hoạt.
   * Chú ý: Mặc định disabled trên môi trường production.
   */
  static register(options: DevtoolsMcpOptions = {}): DynamicModule {
    const defaultOptions: DevtoolsMcpOptions = {
      endpoint: '/_dev/mcp',
      disabled: process.env.NODE_ENV === 'production',
      logBufferSize: 500,
      ...options,
    };

    if (defaultOptions.disabled) {
      return {
        module: DevtoolsMcpModule,
      };
    }

    this.logger.log(`DevTools MCP endpoint initialized at ${defaultOptions.endpoint}`);

    return {
      module: DevtoolsMcpModule,
      providers: [
        {
          provide: DEVTOOLS_OPTIONS_TOKEN,
          useValue: defaultOptions,
        },
        LogBufferService,
        {
          provide: CustomLoggerService,
          useFactory: (bufferService: LogBufferService) => {
            return new CustomLoggerService(bufferService);
          },
          inject: [LogBufferService],
        },
      ],
      controllers: [DevtoolsMcpController],
      exports: [LogBufferService, CustomLoggerService],
    };
  }
}
