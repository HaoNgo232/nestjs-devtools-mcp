# @nestjs-devtools-mcp/plugin

**NestJS Plugin for MCP DevTools**

This package is a NestJS module that allows AI coding agents (Claude, Cursor, etc.) to introspect your application's runtime state through the Model Context Protocol (MCP).

---

## Installation

```bash
npm install @nestjs-devtools-mcp/plugin
```

## Setup

### 1. Register Module in `app.module.ts`

```typescript
import { Module } from '@nestjs/common'
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin'

@Module({
  imports: [DevtoolsMcpModule.register()],
})
export class AppModule {}
```

### 2. Apply Logger in `main.ts`

```typescript
import { NestFactory } from '@nestjs/core'
import { applyDevtoolsLogger } from '@nestjs-devtools-mcp/plugin'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  applyDevtoolsLogger(app)
  await app.listen(3000)
}
bootstrap()
```

---

## Features

- Circular log buffering for AI agents.
- Route introspection via `get_routes`.
- Transparent logger forwarding (keeps existing app log output).
- Localhost-only MCP endpoint guard.
- Production-safe by default (disabled when `NODE_ENV=production` unless explicitly overridden).

## Exposed Endpoint

The plugin exposes a localhost-only endpoint inside your NestJS app:

- `GET /_dev/mcp/health`
- `POST /_dev/mcp/tools/get_logs`
- `POST /_dev/mcp/tools/get_routes`

## Notes

- This package runs inside your NestJS process.
- It does not provide STDIO MCP transport directly. Use `nestjs-devtools-mcp` (bridge package) in your MCP client config.

---

## License

MIT

For detailed documentation, visit the [Main README](https://github.com/HaoNgo232/nestjs-devtools-mcp).
