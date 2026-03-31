import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyDevtoolsLogger } from '@nestjs-devtools-mcp/plugin';

/**
 * Entry point cho demo application.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Tối giản cấu hình chỉ với 1 dòng duy nhất
  applyDevtoolsLogger(app);

  await app.listen(3000);
  console.log('--- DEMO APP ĐANG CHẠY TẠI http://localhost:3000 ---');
}

bootstrap().catch((err) => {
  console.error('Lỗi khi startup Demo App:', err);
});
