import { Module, Logger } from '@nestjs/common'
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin'
import { UserController } from './user.controller'

/**
 * AppModule for the demo application.
 * Integrates DevtoolsMcpModule and periodically generates logs to test the MCP Tool get_logs.
 */
@Module({
  imports: [DevtoolsMcpModule.register()],
  controllers: [UserController],
})
export class AppModule {
  private readonly logger = new Logger('DemoApp')

  constructor() {
    // Simulate periodic logs so the Bridge has data to display
    let count = 1
    setInterval(() => {
      this.logger.log(`Server status update - Log entry #${count++}`)

      if (count % 5 === 0) {
        this.logger.warn(`Warning: Reached log count divisible by 5 (#${count})`)
      }

      if (count % 10 === 0) {
        this.logger.error(`Simulated system error at entry #${count}`, 'FakeStackTrace')
      }
    }, 2000)
  }
}
