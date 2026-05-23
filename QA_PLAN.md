# Kế hoạch Kiểm thử Chất lượng (QA Plan) - NestJS DevTools MCP

Tài liệu này hướng dẫn chi tiết cách thực hiện 5 kịch bản kiểm thử chất lượng (QA) đối với cả **Plugin** (chạy bên trong NestJS) và **MCP Server Proxy** (cầu nối STDIO). Các kịch bản này sử dụng một dự án NestJS thực tế có trong monorepo (`test-nestjs-app`) chạy trên cổng `3005`.

---

## Chuẩn bị Môi trường (Prerequisites)

1. **Cài đặt các gói phụ thuộc và build dự án:**
   ```bash
   pnpm install
   pnpm run build
   ```
2. **Khởi chạy ứng dụng NestJS thực tế (`test-nestjs-app`):**
   ```bash
   pnpm --filter test-nestjs-app start
   # Ứng dụng sẽ chạy tại http://localhost:3005
   ```

---

## 5 Kịch bản QA Chi tiết

### QA-1: Khởi chạy MCP Server qua `npx` & Tự động phát hiện Server (Auto-Discovery)

*   **Mục tiêu:** Kiểm tra MCP Bridge khởi động chính xác bằng lệnh `npx` và phát hiện ứng dụng NestJS đang chạy mà không gặp lỗi thoát tiến trình (lỗi do cache/symlink `npx` làm sai lệch nhận diện file chính).
*   **Các bước thực hiện:**
    1. Trong một terminal mới, chạy MCP Server giả lập thông qua lệnh `npx` trỏ trực tiếp tới thư mục build local:
       ```bash
       npx ./packages/server/dist/index.js
       ```
    2. Đảm bảo tiến trình không bị crash và hiển thị thông báo:
       `NestJS DevTools MCP Bridge has started and is listening on STDIO.`
    3. Gửi lệnh yêu cầu JSON-RPC qua stdin để gọi tool `discover_servers`:
       ```json
       {"jsonrpc":"2.0","method":"tools/call","params":{"name":"discover_servers","arguments":{}},"id":1}
       ```
*   **Kết quả mong đợi:** Phản hồi JSON chứa thông tin cổng `3005` của NestJS app đang chạy:
    ```json
    {
      "jsonrpc": "2.0",
      "result": {
        "content": [
          {
            "type": "text",
            "text": "[\n  {\n    \"port\": 3005,\n    \"name\": \"test-nestjs-app\",\n    ...\n  }\n]"
          }
        ]
      },
      "id": 1
    }
    ```

---

### QA-2: Thu thập log qua logger tuỳ biến (`get_logs`)

*   **Mục tiêu:** Xác minh tính năng thu thập log của plugin hoạt động tốt trên dự án thực tế.
*   **Các bước thực hiện:**
    1. Gửi HTTP request đến ứng dụng NestJS để sinh log:
       ```bash
       curl http://localhost:3005/hello
       ```
    2. Gửi yêu cầu JSON-RPC gọi tool `get_logs` thông qua MCP Server:
       ```json
       {"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_logs","arguments":{"port":3005,"lines":10}},"id":2}
       ```
*   **Kết quả mong đợi:** Trả về danh sách các log gần nhất của ứng dụng, trong đó chứa log dòng:
    `[HelloController] Hello route has been called!`

---

### QA-3: Quét cây Routes thực tế của NestJS (`get_routes`)

*   **Mục tiêu:** Đảm bảo tool phản hồi chính xác toàn bộ danh sách routes đã đăng ký trong NestJS.
*   **Các bước thực hiện:**
    1. Gửi yêu cầu JSON-RPC gọi tool `get_routes` thông qua MCP Server:
       ```json
       {"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_routes","arguments":{"port":3005}},"id":3}
       ```
*   **Kết quả mong đợi:** Danh sách routes phải phản ánh đúng cấu trúc của `test-nestjs-app` bao gồm các controller:
    *   `/hello` (GET) của `HelloController`
    *   `/products` (GET, POST, DELETE) của `ProductsController`
    *   `/_dev/mcp/*` (các endpoint nội bộ của plugin)

---

### QA-4: Giám sát traffic & Lọc lịch sử Request (`get_request_history`)

*   **Mục tiêu:** Kiểm tra khả năng lưu lịch sử HTTP traffic thực tế, lọc lỗi và đảm bảo không bị ô nhiễm bởi các request nội bộ của plugin.
*   **Các bước thực hiện:**
    1. Bắn một loạt các request khác nhau vào NestJS:
       - Request thành công: `GET http://localhost:3005/hello`
       - Request tạo mới: `POST http://localhost:3005/products`
       - Request lỗi 404: `GET http://localhost:3005/notexist`
    2. Gửi yêu cầu JSON-RPC gọi tool `get_request_history` với bộ lọc lỗi:
       ```json
       {"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_request_history","arguments":{"port":3005,"onlyErrors":true}},"id":4}
       ```
    3. Gửi yêu cầu JSON-RPC gọi tool `get_request_history` lọc theo POST:
       ```json
       {"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_request_history","arguments":{"port":3005,"method":"POST"}},"id":5}
       ```
*   **Kết quả mong đợi:**
    *   Khi lọc `onlyErrors: true`, danh sách chỉ chứa request lỗi 404 (`/notexist`).
    *   Khi lọc `method: "POST"`, danh sách chỉ chứa request `POST /products`.
    *   Lịch sử KHÔNG chứa bất kỳ request nào đến đường dẫn `/_dev/mcp/*` (các truy vấn từ MCP server sang plugin).

---

### QA-5: Bảo mật che giấu Config (`get_config`) & localhost guard

*   **Mục tiêu:** Xác minh các khoá nhạy cảm (database credentials, JWT token, v.v.) được che giấu an toàn, và Guard bảo vệ chặn các kết nối từ bên ngoài.
*   **Các bước thực hiện:**
    1. Tắt ứng dụng NestJS và khởi động lại với các biến môi trường cấu hình nhạy cảm:
       ```bash
       DATABASE_URL="mongodb://admin:secretPassword123@localhost:27017/db" JWT_SECRET="mySuperSecretTokenValue" pnpm --filter test-nestjs-app start
       ```
    2. Gửi yêu cầu JSON-RPC gọi tool `get_config` qua MCP Server:
       ```json
       {"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_config","arguments":{"port":3005,"source":"env"}},"id":6}
       ```
    3. Xác minh tính năng của Guard bảo vệ: Gửi request trực tiếp đến `http://localhost:3005/_dev/mcp/health` nhưng giả lập header `x-forwarded-for: 192.168.1.5` để xem Guard có chặn hay không.
*   **Kết quả mong đợi:**
    *   Giá trị của `DATABASE_URL` và `JWT_SECRET` trong phản hồi của `get_config` phải được thay thế hoàn toàn bằng `***MASKED***` (không được lộ password hay token).
    *   Request giả lập IP ngoài gửi đến endpoint của plugin phải bị chặn với mã trạng thái `403 Forbidden` do `LocalhostOnlyGuard`.
