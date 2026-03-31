import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { applyDevtoolsLogger } from '@nestjs-devtools-mcp/plugin'

/**
 * Entry point for the demo application.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })

  // Minimal configuration with just a single line
  applyDevtoolsLogger(app)

  await app.listen(3000)
  console.log('--- DEMO APP IS RUNNING AT http://localhost:3000 ---')
}

bootstrap().catch((err) => {
  console.error('Error during Demo App startup:', err)
})
