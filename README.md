# NestJS DevTools MCP

[![npm version](https://img.shields.io/npm/v/@nestjs-devtools-mcp/plugin.svg?style=flat-square)](https://www.npmjs.com/package/@nestjs-devtools-mcp/plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![NestJS](https://img.shields.io/badge/NestJS-%23E0234E.svg?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-blue.svg?style=flat-square)](https://modelcontextprotocol.io/)

**Give your AI coding agents (Claude, Cursor, Copilot) the superpower to observe your NestJS application's runtime state in real-time.**

Ever wished AI could see your crashed application logs, registered routes, or current DI container without you copy-pasting terminal outputs? This project provides a transparent, zero-config bridge between your running NestJS app and your AI tools via the Model Context Protocol (MCP).

---

## Current MCP Tools

Currently available tools:

- `discover_servers` — Find local NestJS servers with the plugin enabled.
- `get_logs` — Retrieve recent runtime logs from a detected NestJS server.

More tools may be added in future releases.

---

## Quick Start (2 Steps)

### Step 1: Integrate Plugin into NestJS

Install the plugin package in your NestJS application:

```bash
# Using npm
npm install @nestjs-devtools-mcp/plugin

# Using yarn
yarn add @nestjs-devtools-mcp/plugin

# Using pnpm
pnpm add @nestjs-devtools-mcp/plugin
```

Configure `app.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin'

@Module({
  imports: [
    DevtoolsMcpModule.register(), // Automatically disables in production
  ],
})
export class AppModule {}
```

Apply the custom logger in `main.ts` to allow context interception:

```typescript
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { applyDevtoolsLogger } from '@nestjs-devtools-mcp/plugin'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })

  // Activate DevTools logger
  applyDevtoolsLogger(app)

  await app.listen(3000)
}
bootstrap()
```

### Step 2: Configure MCP Client

Add the following to your AI Assistant's MCP settings (e.g., `claude_desktop_config.json`):

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

_That's it! Restart your MCP client and ask your AI: "Fetch the latest logs from my NestJS application."_

---

## Documentation & Guides

Looking for advanced setups or want to contribute? Dive deeper into our docs:

- [**Installation & Usage Guide**](./docs/installation.md) - Advanced setups, installing from source, and troubleshooting.
- [**Development Guide**](./docs/development.md) - For contributors, detailing the monorepo setup, building, testing, and linting.
- [**API Specs**](./packages/plugin/src/contracts/mcp-api.contract.ts) - The MCP protocol specification and contract.

---

## How it Works (Architecture)

The project uses a secure 2-package model to avoid interfering with your app's logic:

```text
AI Client (Claude, Cursor, ...)
    │
    │  [STDIO - MCP Protocol]
    ▼
nestjs-devtools-mcp (Bridge Server via npx)
    │
    │  [HTTP - Localhost Only]
    ▼
@nestjs-devtools-mcp/plugin (Runs inside your App)
    │
    ▼
NestJS Runtime (Logger, Container, Routes)
```

1. **The Plugin** (`@nestjs-devtools-mcp/plugin`) runs inside your NestJS process, safely collecting runtime data into circular buffers and exposing an internal HTTP endpoint.
2. **The Server** (`nestjs-devtools-mcp`) is a lightweight Bridge CLI that manages STDIO communication with the AI and proxies tool calls over HTTP to the plugin.

---

## License

MIT © HaoNgo232.
For production environments, always reassess security assumptions before deploying plugins that observe application state.
