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
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin';

@Module({
  imports: [
    DevtoolsMcpModule.register(),
  ],
})
export class AppModule {}
```

### 2. Apply Logger in `main.ts`
```typescript
import { NestFactory } from '@nestjs/core';
import { applyDevtoolsLogger } from '@nestjs-devtools-mcp/plugin';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  applyDevtoolsLogger(app);
  await app.listen(3000);
}
bootstrap();
```

---

## Features
- Circular log buffering for AI agents.
- Real-time route and module introspection (coming soon).
- Zero-config auto-discovery.
- Production-safe by default.

For detailed documentation, visit the [Main README](https://github.com/HaoNgo232/nestjs-devtools-mcp).
