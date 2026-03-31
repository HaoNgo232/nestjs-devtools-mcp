import { Module, Logger } from '@nestjs/common';
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin';

/**
 * AppModule cho demo application.
 * Tích hợp DevtoolsMcpModule và định kỳ tạo log để kiểm tra MCP Tool get_logs.
 */
@Module({
  imports: [
    DevtoolsMcpModule.register({
      logBufferSize: 100, // Chỉ cần 100 dòng cho demo là đủ
    }),
  ],
})
export class AppModule {
  private readonly logger = new Logger('DemoApp');

  constructor() {
    // Tạo giả lập một số log định kỳ để Bridge có dữ liệu hiển thị
    let count = 1;
    setInterval(() => {
      this.logger.log(`Thông báo server đang chạy - Log entry #${count++}`);
      
      if (count % 5 === 0) {
        this.logger.warn(`Cảnh báo: Đã đạt mốc log chia hết cho 5 (#${count})`);
      }
      
      if (count % 10 === 0) {
        this.logger.error(`Giả lập lỗi hệ thống tại entry #${count}`, 'FakeStackTrace');
      }
    }, 2000);
  }
}
