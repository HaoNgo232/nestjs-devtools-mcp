import {
  Module,
  DynamicModule,
  Global,
  Logger,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common'
import {
  APP_INTERCEPTOR,
  DiscoveryModule,
  Reflector,
  NestApplicationContext,
  NestApplication,
  ModuleRef,
} from '@nestjs/core'
import * as fs from 'fs'
import * as path from 'path'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options'
import { LogBufferService } from './log-buffer.service'
import { RequestHistoryBufferService } from './request-history-buffer.service'
import { RequestHistoryInterceptor } from './request-history.interceptor'
import { RequestHistoryMiddleware } from './request-history.middleware'
import { CustomLoggerService } from './custom-logger.service'
import { DevtoolsMcpController } from './devtools-mcp.controller'
import { DEVTOOLS_COLLECTORS, DevtoolsCollector } from './collectors/collector.interface'
import { LogCollector } from './collectors/log.collector'
import { RouteCollector } from './collectors/route.collector'
import { RequestHistoryCollector } from './collectors/request-history.collector'
import { ConfigCollector } from './collectors/config.collector'
import { ErrorCollector } from './collectors/error.collector'
import { ErrorBufferService } from './error-buffer.service'
import { UnhandledErrorListener } from './unhandled-error.listener'
import { RequestContextService } from './request-context.service'

// Auto-patch NestApplicationContext prototype to apply CustomLoggerService on init
let prototypePatched = false

interface NestAppContextLike {
  get: (token: unknown) => unknown
  useLogger: (logger: unknown) => void
}

function patchNestApplicationPrototype() {
  if (prototypePatched) {
    return
  }
  prototypePatched = true

  try {
    const classesToPatch = [NestApplicationContext, NestApplication].filter(Boolean)

    for (const cls of classesToPatch) {
      if (cls && cls.prototype && typeof cls.prototype.init === 'function') {
        const originalInit = cls.prototype.init
        cls.prototype.init = async function (this: NestAppContextLike, ...args: unknown[]) {
          try {
            const customLogger = this.get(CustomLoggerService)
            if (customLogger) {
              this.useLogger(customLogger)
              DevtoolsMcpModule.loggerApplied = true
            }
          } catch (_err) {
            // Ignore
          }

          try {
            return await originalInit.apply(this, args as Parameters<typeof originalInit>)
          } catch (bootstrapError) {
            try {
              const listener = this.get(UnhandledErrorListener) as UnhandledErrorListener | undefined
              if (listener) {
                listener.captureBootstrapError(bootstrapError, 'Bootstrap')
              }
            } catch (_err) {
              // Ignore
            }
            throw bootstrapError
          }
        }
      }
    }
  } catch (_err) {
    // Fail-safe
  }
}

patchNestApplicationPrototype()

/**
 * DevtoolsMcpModule is designed to be embedded in a NestJS App.
 * Provides real-time communication capabilities for MCP Agents via Bridge.
 */
@Global()
@Module({})
export class DevtoolsMcpModule implements NestModule, OnApplicationBootstrap, OnApplicationShutdown {
  private static readonly logger = new Logger('DevtoolsMcp')
  static loggerApplied = false

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Helper function to detect project name from host application.
   * Finds the package.json in process.cwd().
   */
  private static getProjectName(): string {
    try {
      const packagePath = path.join(process.cwd(), 'package.json')
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
        if (packageJson.name) {
          return packageJson.name
        }
      }
    } catch {
      // Ignore if cannot read file
    }

    // Fallback to current directory name or generic default
    try {
      return path.basename(process.cwd()) || 'nestjs-devtools-mcp'
    } catch {
      return 'nestjs-devtools-mcp'
    }
  }

  /**
   * Dynamic module registration method, allowing flexible configuration.
   * Note: Disabled on production environment by default.
   */
  static register(options: DevtoolsMcpOptions = {}): DynamicModule {
    const defaultOptions: DevtoolsMcpOptions = {
      endpoint: '/_dev/mcp',
      disabled: process.env.NODE_ENV === 'production',
      logBufferSize: 500,
      requestHistorySize: 100,
      errorBufferSize: 100,
      name: this.getProjectName(),
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
        RequestContextService,
        LogBufferService,
        RequestHistoryBufferService,
        ErrorBufferService,
        UnhandledErrorListener,
        RequestHistoryMiddleware,
        {
          provide: CustomLoggerService,
          useFactory: (bufferService: LogBufferService, contextService: RequestContextService) => {
            return new CustomLoggerService(bufferService, 'App', contextService)
          },
          inject: [LogBufferService, RequestContextService],
        },
        RequestHistoryInterceptor,
        {
          provide: APP_INTERCEPTOR,
          useExisting: RequestHistoryInterceptor,
        },
        LogCollector,
        RouteCollector,
        RequestHistoryCollector,
        ConfigCollector,
        ErrorCollector,
        Reflector,
        /**
         * Register collectors using factory to ensure they are always provided as an array.
         * Đăng ký các collector qua factory để đảm bảo chúng luôn được cung cấp dưới dạng mảng.
         */
        {
          provide: DEVTOOLS_COLLECTORS,
          useFactory: (...collectors: DevtoolsCollector[]) => collectors,
          inject: [LogCollector, RouteCollector, RequestHistoryCollector, ConfigCollector, ErrorCollector],
        },
      ],
      controllers: [DevtoolsMcpController],
      exports: [
        LogBufferService,
        RequestHistoryBufferService,
        ErrorBufferService,
        UnhandledErrorListener,
        CustomLoggerService,
        RequestContextService,
      ],
    }
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestHistoryMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL })
  }

  onApplicationBootstrap() {
    try {
      const listener = this.moduleRef.get(UnhandledErrorListener, { strict: false })
      if (listener) {
        listener.attach()
      }
    } catch (_err) {
      // Ignore
    }

    setTimeout(() => {
      if (!DevtoolsMcpModule.loggerApplied) {
        console.warn(
          '[DevtoolsMcp] CustomLoggerService was not automatically applied. ' +
            'Please ensure that you have not overridden the logger after importing DevtoolsMcpModule.',
        )
      }
    }, 100)
  }

  onApplicationShutdown() {
    try {
      const listener = this.moduleRef.get(UnhandledErrorListener, { strict: false })
      if (listener) {
        listener.detach()
      }
    } catch (_err) {
      // Ignore
    }
  }
}
