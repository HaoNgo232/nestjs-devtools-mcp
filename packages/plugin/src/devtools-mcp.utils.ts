import { INestApplicationContext } from '@nestjs/common';
import { CustomLoggerService } from './custom-logger.service';

/**
 * Utility helper để kích hoạt DevTools Logger trong ứng dụng NestJS.
 * Giúp giảm friction cho người dùng từ 3 dòng wiring thủ công xuống còn 1 dòng duy nhất.
 * 
 * @param app instance của INestApplication hoặc INestApplicationContext đã được khởi tạo.
 */
export function applyDevtoolsLogger(app: INestApplicationContext): void {
  try {
    const logger = app.get(CustomLoggerService);
    app.useLogger(logger);
  } catch (error) {
    // Không ném lỗi để đảm bảo NestJS app vẫn chạy bình thường nếu DevtoolsMcpModule chưa được import
    console.error('[DevtoolsMcp] Không thể kích hoạt Logger tự động. Hãy đảm bảo DevtoolsMcpModule đã được register trong AppModule.', error);
  }
}
