## MỤC ĐÍCH DUY NHẤT CỦA DỰ ÁN NÀY

Cho phép AI coding agents (Claude, Cursor, Copilot...) **nhìn thấy runtime state** của
NestJS server đang chạy — logs, routes, modules, providers, errors — thông qua
Model Context Protocol (MCP).

Nếu một quyết định thiết kế không phục vụ mục đích này, KHÔNG làm.

---

## TRIẾT LÝ: NEAR-ZERO CONFIG

### Trải nghiệm user PHẢI là:

**Bước 1** — Cài plugin vào NestJS project:

```bash
npm install @nestjs-devtools-mcp/plugin
```

```typescript
// app.module.ts — CHỈ CẦN 1 DÒNG IMPORT
import { DevtoolsMcpModule } from "@nestjs-devtools-mcp/plugin";

@Module({
  imports: [DevtoolsMcpModule.register()],
})
export class AppModule {}
```

**Bước 2** — Paste vào MCP client config:

```json
{
  "nestjs-devtools": {
    "command": "npx",
    "args": ["-y", "nestjs-devtools-mcp@latest"]
  }
}
```

**XONG. Không env var. Không config port. Không config URL.**

### Nếu bạn đang implement thứ gì đó mà user phải config thêm bất kỳ thứ gì ngoài 2 bước trên -> DỪNG LẠI. Tìm cách auto-detect hoặc dùng convention mặc định.

---

## KIẾN TRÚC — 2 PACKAGE, 2 THẾ GIỚI KHÁC NHAU

```
AI Client (Claude, Cursor...)
    STDIO
Package B: nestjs-devtools-mcp (bridge)     - TypeScript thuần, KHÔNG NestJS
    HTTP (localhost only)
Package A: @nestjs-devtools-mcp/plugin      - NestJS module, chạy TRONG app
    In-process access
NestJS Runtime (Logger, DI Container, Routes...)
```

### Package A: `@nestjs-devtools-mcp/plugin`

- LÀ NestJS module. Dùng decorators, DI, Controllers.
- CHẠY TRONG NestJS process của user.
- EXPOSE endpoint `/_dev/mcp` trên cùng HTTP server với app.
- THU THẬP runtime data bằng cách truy cập NestJS internals.
- PEER DEPENDENCIES: `@nestjs/common`, `@nestjs/core` (user đã có sẵn).

### Package B: `nestjs-devtools-mcp`

- KHÔNG PHẢI NestJS app. KHÔNG import NestJS. KHÔNG BAO GIỜ.
- LÀ lightweight Node.js script chạy qua STDIO.
- DEPENDENCIES: chỉ `@modelcontextprotocol/sdk` + `zod`. Hết.
- CHẠY NHƯ CLI tool: `npx -y nestjs-devtools-mcp@latest`
- BRIDGE: nhận tool calls từ AI client -> gọi HTTP đến plugin endpoint -> trả kết quả.

### TUYỆT ĐỐI KHÔNG:

- KHÔNG import `@nestjs/*` trong Package B.
- KHÔNG import `@modelcontextprotocol/sdk` trong Package A.
- KHÔNG tạo HTTP server riêng trong Package B (dùng STDIO transport).
- KHÔNG merge hai package thành một.

---

## NGUYÊN TẮC BẤT BIẾN

### 1. Plugin phải TRANSPARENT

- Plugin PHẢI forward 100% logs xuống logger gốc. Terminal của developer PHẢI hiển thị log y như không có plugin.
- Plugin KHÔNG ĐƯỢC thay đổi behavior của NestJS app dưới bất kỳ hình thức nào.
- Nếu plugin crash, NestJS app PHẢI tiếp tục chạy bình thường.

### 2. Production-safe by default

- Plugin tự disable khi `NODE_ENV === 'production'` (trừ khi user explicitly override).
- Endpoint `/_dev/mcp` chỉ chấp nhận request từ localhost (127.0.0.1 / ::1).
- KHÔNG BAO GIỜ expose runtime data ra ngoài localhost.

### 3. Auto-discovery, không manual config

- Bridge tự scan ports tìm NestJS server có plugin.
- Nếu chỉ có 1 server -> tự kết nối, không hỏi.
- Nếu nhiều server -> liệt kê cho AI chọn.
- Nếu không tìm thấy -> trả message hướng dẫn rõ ràng.

### 4. Mỗi tool làm MỘT việc

- `get_logs` chỉ trả logs. Không phân tích, không suggest fix.
- `get_routes` chỉ trả route list. Không generate code.
- AI client sẽ tự quyết định làm gì với data. Tool chỉ cung cấp data.

### 5. Response format nhất quán

Mọi tool response đều trả MCP TextContent:

```typescript
{
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }];
}
```

Data luôn là JSON. Không Markdown, không plain text, không HTML trong response body.

---

## PHÂN BIỆT ĐÚNG/SAI — ĐỌC KHI NGHI NGỜ

### ĐÚNG:

- Plugin dùng NestJS `DiscoveryService` để lấy route list -> ĐÚNG, đây là in-process access.
- Bridge dùng `fetch("http://localhost:3000/_dev/mcp/tools/get_logs")` -> ĐÚNG, đây là HTTP proxy.
- Bridge dùng `StdioServerTransport` từ MCP SDK -> ĐÚNG, đây là STDIO transport.
- Plugin intercept NestJS Logger bằng custom `LoggerService` -> ĐÚNG, rồi forward xuống console.

### SAI:

- Bridge import `@nestjs/core` để đọc DI container -> SAI. Bridge là process khác, không access được.
- Plugin dùng MCP SDK để expose tools -> SAI. Plugin expose HTTP endpoints, bridge mới dùng MCP SDK.
- Bridge tạo Express server để nhận HTTP requests -> SAI. Bridge dùng STDIO, không HTTP server.
- Plugin yêu cầu user truyền port vào config -> SAI. Plugin chạy trên cùng port với NestJS app.
- Bridge yêu cầu user config URL của NestJS server -> SAI. Bridge tự discover.

---

## THỨ TỰ IMPLEMENT — PHASE 1 (MVP)

Chỉ làm đủ để demo: AI client gọi tool -> thấy log của NestJS server đang chạy.

1. Plugin: `DevtoolsMcpModule.register()` — DynamicModule, global
2. Plugin: `LogBufferService` — circular buffer giữ log entries
3. Plugin: `CustomLoggerService` — intercept + forward + buffer
4. Plugin: `LocalhostOnlyGuard` — reject non-localhost requests
5. Plugin: `DevtoolsMcpController` — `GET /health` + `POST /tools/get_logs`
6. Bridge: `index.ts` — entry point với shebang + STDIO transport
7. Bridge: `discovery.ts` — scan ports, kiểm tra `/_dev/mcp/health`
8. Bridge: `discover_servers` tool
9. Bridge: `get_logs` tool — proxy đến plugin endpoint
10. Bridge: Smart port resolution (auto-select nếu 1 server)

KHÔNG làm Phase 2, 3 cho đến khi Phase 1 hoàn chỉnh và test được end-to-end.

---

## KHI BẠN KHÔNG CHẮC

Đọc lại mục "MỤC ĐÍCH DUY NHẤT" ở đầu file này.
Đọc lại mục "TUYỆT ĐỐI KHÔNG".
Đọc lại mục "PHÂN BIỆT ĐÚNG/SAI".

Nếu vẫn không chắc → hỏi user thay vì tự quyết định.
