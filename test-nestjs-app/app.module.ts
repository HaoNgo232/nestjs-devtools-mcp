import { Module, Get, Post, Delete, Controller, Logger } from '@nestjs/common'
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin'

@Controller('hello')
export class HelloController {
  private readonly logger = new Logger('HelloController')

  @Get()
  getHello() {
    this.logger.log('Hello route has been called!')
    return { message: 'Hello from NestJS MCP Test App!' }
  }
}

@Controller('products')
export class ProductsController {
  private readonly logger = new Logger('ProductsController')

  @Get()
  getAll() {
    this.logger.log('Fetching all products...')
    return [
      { id: 1, name: 'Premium Product A', price: 99.9 },
      { id: 2, name: 'Standard Product B', price: 49.9 },
    ]
  }

  @Post()
  create() {
    this.logger.warn('Creating a new product (mock action)...')
    return { success: true, id: 3 }
  }

  @Delete()
  delete() {
    this.logger.error('Deleting a product (mock action)...')
    return { success: true }
  }
}

@Controller('errors')
export class ErrorsController {
  private readonly logger = new Logger('ErrorsController')

  @Get('runtime')
  triggerRuntimeError() {
    this.logger.error('Custom runtime error logged via Nest Logger', 'Error: Stack trace simulated\n  at ErrorsController.triggerRuntimeError')
    return { status: 'logged_runtime_error' }
  }

  @Get('5xx')
  triggerHttp5xxError() {
    throw new Error('Database connection failed - Simulated 500 error')
  }

  @Get('unhandled-rejection')
  triggerUnhandledRejection() {
    setTimeout(() => {
      Promise.reject(new Error('Async unhandled rejection test error'))
    }, 50)
    return { status: 'triggered_unhandled_rejection' }
  }
}

@Module({
  imports: [DevtoolsMcpModule.register()],
  controllers: [HelloController, ProductsController, ErrorsController],
})

export class AppModule {
  private readonly logger = new Logger('AppModule')

  constructor() {
    let tick = 1
    setInterval(() => {
      this.logger.log(`[Manual Test App] Ping log #${tick++}`)
    }, 4000)
  }
}
