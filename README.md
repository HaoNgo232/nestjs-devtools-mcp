# NestJS DevTools MCP

Allows AI Coding Agents (Claude, Cursor, Copilot...) to observe the **runtime state** of your NestJS application — logs, routes, modules, providers — through the Model Context Protocol (MCP). This project provides a transparent bridge between your running NestJS app and AI tools to enhance debugging and development.

## 🏗️ **Architecture & System Design**

The project is designed with a 2-package model to ensure security and zero-interference with your original application logic:

```text
AI Client (Claude, Cursor, ...)
    │
    │  (STDIO - MCP)
    ▼
nestjs-devtools-mcp (packages/server)          ← MCP Bridge (CLI)
    │
    │  HTTP (localhost only)
    ▼
@nestjs-devtools-mcp/plugin (packages/plugin)  ← NestJS Module
    │
    ▼
NestJS Runtime (Logger, DI Container, Routes...)
```

### **Plugin Package: `@nestjs-devtools-mcp/plugin`**

Runs **inside your NestJS process**, collecting runtime data and exposing internal HTTP endpoints:

- `DevtoolsMcpModule`: Dynamic module for registration.
- `DevtoolsMcpController`: Exposes `/_dev/mcp/health` and `/_dev/mcp/tools/get_logs` endpoints.
- `CustomLoggerService`: Intercepts and forwards logs to the buffer.
- `LogBufferService`: Circular buffer for recently generated logs.
- `LocalhostOnlyGuard`: Protects endpoints, allowing access only from localhost.

### **Bridge Package: `nestjs-devtools-mcp`**

Runs as a standalone CLI tool, communicating with the AI client via STDIO and proxying requests to the plugin:

- Entry point with STDIO transport.
- Auto-discovery scans ports to locate active NestJS apps with the plugin.
- Proxy layer converts MCP tool calls into HTTP requests.

## 📦 **Monorepo Packages**

| Package                       | Path              | Purpose                                    | Installation                              |
| ----------------------------- | ----------------- | ------------------------------------------ | ----------------------------------------- |
| `@nestjs-devtools-mcp/plugin` | `packages/plugin` | Plugin to collect runtime data from NestJS | `npm install @nestjs-devtools-mcp/plugin` |
| `nestjs-devtools-mcp`         | `packages/server` | MCP Bridge Server (run via npx)            | `npx -y nestjs-devtools-mcp@latest`       |
| `demo-app`                    | `demo-app`        | Sample NestJS app for testing              | Local development only                    |

## 🚀 **Quick Start (2 Steps)**

### **Step 1: Integrate Plugin into NestJS**

Install the plugin package:

```bash
npm install @nestjs-devtools-mcp/plugin
```

Configure `app.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { DevtoolsMcpModule } from "@nestjs-devtools-mcp/plugin";

@Module({
  imports: [
    DevtoolsMcpModule.register(), // Zero config - Automatically disables in production
  ],
})
export class AppModule {}
```

Apply the custom logger in `main.ts`:

```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { applyDevtoolsLogger } from "@nestjs-devtools-mcp/plugin";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Activate DevTools logger
  applyDevtoolsLogger(app);

  await app.listen(3000);
}
bootstrap();
```

> **Reference:** See `demo-app/src/app.module.ts` and `demo-app/src/main.ts` for a complete example.

### **Step 2: Configure MCP Client**

Add the following to your MCP settings (e.g., `claude_desktop_config.json`):

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

## 🛠️ **Development Guidelines**

**Basic Commands:**

```bash
# Install all dependencies
npm install

# Build all packages
npm run build --workspaces

# Run tests
npm run test --workspaces

# Check code style
npm run lint

# Start demo app
cd demo-app && npm start
```

**Design Principles:**

- The plugin **must not** change the original behavior of the NestJS app.
- Logs must be forwarded to the console as usual.
- If the plugin crashes, the NestJS app must continue to function normally.
- Endpoints allow access from localhost only.
- Automatically disabled in production environment by default.

## 🐛 **Troubleshooting**

### **1. MCP client cannot see the server**

**Symptom:** AI client does not list the `nestjs-devtools` server.
**Checks:**

- MCP configuration is in correct JSON format.
- `npx` is able to run/download `nestjs-devtools-mcp`.
- Check MCP client logs for Node.js/TypeScript errors.

### **2. Bridge cannot find NestJS app**

**Symptom:** Tool `discover_servers` returns an empty array.
**Checks:**

- NestJS app has imported `DevtoolsMcpModule.register()`.
- `applyDevtoolsLogger(app)` has been called in `main.ts`.
- The app is running on localhost (Test: `GET http://localhost:3000/_dev/mcp/health`).

### **3. No logs received**

**Symptom:** Tool `get_logs` returns few or no logs.
**Checks:**

- Application is writing logs via NestJS Logger.
- `CustomLoggerService` has been correctly applied.
- `logBufferSize` is large enough for your needs.
- Application context is not running in production mode.

## 🤝 **Contributing**

This project is currently for experimental and personal use. If you want to contribute:

1. Fork the repository and create a branch from `main`.
2. Perform changes and update tests if necessary.
3. Open a Pull Request with a clear description of:
   - What was modified.
   - How to manually test the changes.

## 📄 **License**

MIT – For production environments, please reassess security assumptions and plugin behavior to fit your system.
