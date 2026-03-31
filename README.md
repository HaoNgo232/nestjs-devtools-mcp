# NestJS DevTools MCP 🚀

Cho phép các AI Coding Agents (Claude, Cursor, Copilot...) **nhìn thấy runtime state** của ứng dụng NestJS của bạn — logs, routes, modules, providers — thông qua Model Context Protocol (MCP).

## 🌟 Tính năng
- **Runtime Log Monitoring**: AI có thể đọc log trực tiếp từ server đang chạy.
- **Auto-Discovery**: Tự động tìm kiếm server NestJS trên localhost.
- **Zero Configuration**: Cài đặt tối giản, không cần cấu hình port thủ công.
- **Production Safe**: Chỉ cho phép truy cập từ localhost và tự động tắt ở môi trường production.

## 📦 Các Package

| Package | Mục đích | Cài đặt |
| --- | --- | --- |
| `@nestjs-devtools-mcp/plugin` | Plugin cài vào NestJS app để thu thập dữ liệu. | `npm install @nestjs-devtools-mcp/plugin` |
| `nestjs-devtools-mcp` | Bridge MCP Server (chạy qua npx). | `npx -y nestjs-devtools-mcp@latest` |

---

## 🚀 Hướng dẫn cài đặt (2 Bước)

### Bước 1: Cài đặt và tích hợp Plugin vào NestJS

Cài đặt package `@nestjs-devtools-mcp/plugin` vào dự án NestJS của bạn:

```bash
npm install @nestjs-devtools-mcp/plugin
```

Cấu hình trong `app.module.ts`:

```typescript
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin';

@Module({
  imports: [
    DevtoolsMcpModule.register(), // Mặc định tự tắt khi NODE_ENV === 'production'
  ],
})
export class AppModule {}
```

Sử dụng Custom Logger trong `main.ts` (để AI có thể đọc được log):

```typescript
import { NestFactory } from '@nestjs/core';
import { CustomLoggerService } from '@nestjs-devtools-mcp/plugin';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  
  // Kích hoạt Custom Logger
  app.useLogger(app.get(CustomLoggerService));
  
  await app.listen(3000);
}
bootstrap();
```

### Bước 2: Cấu hình MCP Client (Claude Desktop, Cursor...)

Thêm cấu hình sau vào MCP settings của bạn (thường là `claude_desktop_config.json` hoặc trong phần Settings của Cursor):

```json
{
  "mcpServers": {
    "nestjs-devtools": {
      "command": "npx",
      "args": ["-y", "nestjs-devtools-mcp@latest"]
    }
  }
}
```

---

## 🛠️ Phát triển & Kiểm thử

Dự án sử dụng Monorepo với npm workspaces:

```bash
# Cài đặt toàn bộ dependencies
npm install

# Build toàn bộ project
npm run build --workspaces

# Chạy test
npm test --workspaces
```

---

## 🚢 Hướng dẫn Publish lên NPM Store

Dự án này sử dụng cấu trúc Monorepo, bạn cần publish từng package riêng biệt.

### 1. Đăng nhập vào NPM (nếu chưa)
```bash
npm login
```

### 2. Publish Plugin Package
```bash
cd packages/plugin
npm run build
npm publish --access public
```

### 3. Publish Server Bridge Package
```bash
cd packages/server
npm run build
npm publish --access public
```

**Lưu ý**: Đảm bảo tăng version trong `package.json` của mỗi package trước khi publish.

---

## 🛡️ License
MIT - Tự do sử dụng và đóng góp! 🇻🇳
