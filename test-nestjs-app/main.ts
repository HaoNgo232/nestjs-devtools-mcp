import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { applyDevtoolsLogger } from '@nestjs-devtools-mcp/plugin'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })

  // Activate DevTools logger
  applyDevtoolsLogger(app)

  await app.listen(3005)
  console.log('\n======================================================')
  console.log('🚀 NESTJS TEST APP RUNNING AT http://localhost:3005')
  console.log('👉 DevTools MCP endpoint: http://localhost:3005/_dev/mcp/health')
  console.log('======================================================\n')
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap NestJS test app:', err)
})
