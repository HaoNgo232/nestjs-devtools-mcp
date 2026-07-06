# NestJS DevTools MCP

[![npm version](https://img.shields.io/npm/v/@nestjs-devtools-mcp/plugin.svg?style=flat-square)](https://www.npmjs.com/package/@nestjs-devtools-mcp/plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](./LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-%23E0234E.svg?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-blue.svg?style=flat-square)](https://modelcontextprotocol.io/)

Give your AI coding agents real-time visibility into your NestJS application.

**NestJS DevTools MCP** connects a running NestJS app to AI tools such as Claude, Cursor, Copilot, Cline, and Roo Code through the Model Context Protocol (MCP). Instead of copy-pasting logs, routes, request errors, or config values into chat, your AI assistant can inspect them directly from your local app.

---

## What You Get

- Runtime logs from your NestJS app
- Registered HTTP routes
- Recent HTTP request history
- Sanitized runtime config
- Runtime error history
- Local server discovery
- Localhost-only access by default
- Production-safe default behavior

---

## Packages

This monorepo publishes 2 packages:

| Package                                                                                    | Purpose                                 |
| ------------------------------------------------------------------------------------------ | --------------------------------------- |
| [`@nestjs-devtools-mcp/plugin`](https://www.npmjs.com/package/@nestjs-devtools-mcp/plugin) | NestJS module installed inside your app |
| [`nestjs-devtools-mcp`](https://www.npmjs.com/package/nestjs-devtools-mcp)                 | MCP STDIO bridge used by AI clients     |

---

## Quick Start

### 1. Install the NestJS Plugin

```bash
npm install @nestjs-devtools-mcp/plugin
```

Or with pnpm:

```bash
pnpm add @nestjs-devtools-mcp/plugin
```

### 2. Register the Module

```ts
import { Module } from '@nestjs/common'
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin'

@Module({
  imports: [DevtoolsMcpModule.register()],
})
export class AppModule {}
```

### 3. Use `bufferLogs` During Bootstrap

```ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })

  await app.listen(3000)
}

bootstrap()
```

The DevTools logger is applied automatically when the module is registered.

### 4. Configure Your MCP Client

Add this MCP server to your AI client configuration:

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

Restart your AI client, then ask:

```txt
Discover my local NestJS servers and show recent errors.
```

---

## Available MCP Tools

| Tool                  | Description                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `discover_servers`    | Scan localhost for NestJS apps with the plugin enabled                                   |
| `get_errors`          | Read runtime errors from bootstrap, logger, unhandled exceptions, and HTTP 5xx responses |
| `get_logs`            | Read recent runtime logs                                                                 |
| `get_routes`          | List registered HTTP routes                                                              |
| `get_request_history` | Inspect recent HTTP requests, statuses, durations, and errors                            |
| `get_config`          | Inspect sanitized runtime config from `process.env` and selected `ConfigService` keys    |

---

## Example Prompts

After setup, try asking your AI assistant:

```txt
Find my running NestJS app and show me the latest runtime logs.
```

```txt
List all registered routes in my NestJS server.
```

```txt
Show recent failed HTTP requests and explain likely causes.
```

```txt
Check runtime config values related to DATABASE.
```

```txt
Show unhandled errors from the last few minutes.
```

---

## Runtime Endpoint

The plugin exposes a localhost-only internal endpoint inside your NestJS app:

```txt
GET  /_dev/mcp/health
POST /_dev/mcp/tools/get_logs
POST /_dev/mcp/tools/get_routes
POST /_dev/mcp/tools/get_request_history
POST /_dev/mcp/tools/get_config
POST /_dev/mcp/tools/get_errors
```

The bridge connects to this endpoint through `localhost`.

---

## Configuration

### Plugin Options

```ts
DevtoolsMcpModule.register({
  name: 'my-api',
  logBufferSize: 500,
  requestHistorySize: 100,
  errorBufferSize: 100,
})
```

| Option               | Default                           | Description                     |
| -------------------- | --------------------------------- | ------------------------------- |
| `name`               | Auto-detected from `package.json` | App name shown during discovery |
| `disabled`           | `true` when `NODE_ENV=production` | Disable the plugin              |
| `logBufferSize`      | `500`                             | Max runtime log entries         |
| `requestHistorySize` | `100`                             | Max request history entries     |
| `errorBufferSize`    | `100`                             | Max runtime error entries       |

### Bridge Environment Variables

| Variable                 | Default | Description                                                   |
| ------------------------ | ------- | ------------------------------------------------------------- |
| `NESTJS_MCP_SCAN_START`  | `3000`  | First port to scan                                            |
| `NESTJS_MCP_SCAN_END`    | `3010`  | Last port to scan                                             |
| `NESTJS_MCP_PREFIX`      | empty   | Prefix used when probing the health endpoint                  |
| `NESTJS_MCP_CONFIG_KEYS` | empty   | Comma-separated `ConfigService` keys allowed for `get_config` |

Example:

```bash
NESTJS_MCP_SCAN_START=3000 NESTJS_MCP_SCAN_END=4000 npx nestjs-devtools-mcp
```

---

## Security Model

This project is designed for local development and debugging.

Security defaults:

- Plugin is disabled when `NODE_ENV=production`
- MCP endpoint is protected by a localhost-only guard
- Request and response bodies are not captured by default
- Internal `/_dev/mcp/*` calls are excluded from request history
- Sensitive config values are always masked
- ConfigService values are only read from explicitly declared keys

Sensitive keys and values such as passwords, tokens, auth headers, database URLs, private keys, cookies, sessions, JWTs, and credentials are returned as:

```txt
***MASKED***
```

---

## How It Works

```txt
AI Client
  │
  │ MCP over STDIO
  ▼
nestjs-devtools-mcp
  │
  │ HTTP over localhost
  ▼
@nestjs-devtools-mcp/plugin
  │
  ▼
Running NestJS App
```

The architecture intentionally keeps responsibilities separate:

- The plugin runs inside the NestJS app and collects runtime state.
- The bridge runs as an MCP server over STDIO.
- The bridge does not start an HTTP server.
- The plugin does not depend on the MCP SDK.

---

## Development

Install dependencies:

```bash
pnpm install
```

Build all packages:

```bash
pnpm build
```

Run tests:

```bash
pnpm test
```

Run lint:

```bash
pnpm lint
```

Run the full local CI check:

```bash
pnpm ci
```

---

## Documentation

- [Installation Guide](./docs/installation.md)
- [Development Guide](./docs/development.md)
- [Plugin Package](./packages/plugin/README.md)
- [Bridge Package](./packages/server/README.md)

---

## License

MIT © HaoNgo232

For production environments, always reassess security assumptions before enabling runtime introspection tools.
