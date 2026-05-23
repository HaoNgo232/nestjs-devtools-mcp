import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

/**
 * Entry point for the demo application.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Keep bufferLogs: true to verify auto-applied logger captures startup logs
  })

  // CustomLoggerService is auto-applied by DevtoolsMcpModule during bootstrap.

  await app.listen(3000)
  console.log('--- DEMO APP IS RUNNING AT http://localhost:3000 ---')
}

bootstrap().catch((err) => {
  console.error('Error during Demo App startup:', err)
})
