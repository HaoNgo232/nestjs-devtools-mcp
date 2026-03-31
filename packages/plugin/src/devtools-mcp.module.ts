import { Module, DynamicModule, Global, Logger } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options'
import { LogBufferService } from './log-buffer.service'
import { CustomLoggerService } from './custom-logger.service'
import { DevtoolsMcpController } from './devtools-mcp.controller'
import { DEVTOOLS_COLLECTORS, DevtoolsCollector } from './collectors/collector.interface'
import { LogCollector } from './collectors/log.collector'
import { RouteCollector } from './collectors/route.collector'

/**
 * DevtoolsMcpModule is designed to be embedded in a NestJS App.
 * Provides real-time communication capabilities for MCP Agents via Bridge.
 */
@Global()
@Module({})
export class DevtoolsMcpModule {
  private static readonly logger = new Logger('DevtoolsMcp')

  /**
   * Dynamic module registration method, allowing flexible configuration.
   * Note: Disabled on production environment by default.
   */
  static register(options: DevtoolsMcpOptions = {}): DynamicModule {
    const defaultOptions: DevtoolsMcpOptions = {
      endpoint: '/_dev/mcp',
      disabled: process.env.NODE_ENV === 'production',
      logBufferSize: 500,
      ...options,
    }

    if (defaultOptions.disabled) {
      return {
        module: DevtoolsMcpModule,
      }
    }

    this.logger.log(`DevTools MCP endpoint initialized at ${defaultOptions.endpoint}`)

    return {
      module: DevtoolsMcpModule,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: DEVTOOLS_OPTIONS_TOKEN,
          useValue: defaultOptions,
        },
        LogBufferService,
        {
          provide: CustomLoggerService,
          useFactory: (bufferService: LogBufferService) => {
            return new CustomLoggerService(bufferService)
          },
          inject: [LogBufferService],
        },
        LogCollector,
        RouteCollector,
        /**
         * Register collectors using factory to ensure they are always provided as an array.
         * Đăng ký các collector qua factory để đảm bảo chúng luôn được cung cấp dưới dạng mảng.
         */
        {
          provide: DEVTOOLS_COLLECTORS,
          useFactory: (...collectors: DevtoolsCollector[]) => collectors,
          inject: [LogCollector, RouteCollector],
        },
      ],
      controllers: [DevtoolsMcpController],
      exports: [LogBufferService, CustomLoggerService],
    }
  }
}
