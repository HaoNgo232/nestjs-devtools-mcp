import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomLoggerService } from '@nestjs-devtools-mcp/plugin';

/**
 * Entry point cho demo application.
 * Cấu hình sử dụng CustomLoggerService để MCP có thể quan sát được log.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Không cần log tại đây vì chúng ta sẽ dùng CustomLogger ngay sau khi app khởi tạo xong
    bufferLogs: true,
  });

  // Inject CustomLoggerService từ module đã đăng ký
  // Vì CustomLoggerService đã được đặt làm Global Provider nên có thể get từ app
  const customLogger = app.get(CustomLoggerService);
  app.useLogger(customLogger);

  await app.listen(3000);
  console.log('--- DEMO APP ĐANG CHẠY TẠI http://localhost:3000 ---');
  console.log('--- KHỞI CHẠY BRIDGE ĐỂ XEM LOG ---');
}

bootstrap().catch((err) => {
  console.error('Lỗi khi startup Demo App:', err);
});
