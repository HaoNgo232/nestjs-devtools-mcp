# nestjs-devtools-mcp

Model Context Protocol (MCP) server for NestJS applications. Exposes runtime logs, routes, request history, errors, and configuration to MCP-compatible AI clients over STDIO.

[![npm version](https://img.shields.io/npm/v/nestjs-devtools-mcp.svg)](https://www.npmjs.com/package/nestjs-devtools-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Architecture

```
AI Client (Cursor / Claude / etc.)
              │
              │  MCP (STDIO)
              ▼
    nestjs-devtools-mcp (Bridge)
              │
              │  HTTP (localhost)
              ▼
   NestJS App (Preload Hook)
```

The bridge communicates with the AI client via STDIO and queries the running NestJS application over localhost HTTP.

---

## Setup

### 1. Configure MCP Client

Add the server to your MCP client configuration.

#### Cursor (`~/.cursor/mcp.json` or project `.cursor/mcp.json`)
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

#### Claude Desktop
Configuration file paths:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

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

#### Claude Code CLI
```bash
claude mcp add nestjs-devtools -- npx -y nestjs-devtools-mcp@latest
```

---

### 2. Enable in NestJS Project

In the NestJS project root, run:

```bash
npx nestjs-devtools-mcp init
```

This appends `NODE_OPTIONS="--require nestjs-devtools-mcp/register"` to `.env.local` and adds `.env.local` to `.gitignore`. No modifications to TypeScript source files are made.

Alternatively, run without creating configuration files:

```bash
npx nestjs-devtools-mcp run -- npm run start:dev
```

---

### 3. Start the Application

Start the development server:

```bash
npm run start:dev
```

The preload hook attaches during startup, enables log buffering, and exposes local inspection endpoints.

---

### 4. Query via MCP

The AI client can now query runtime state using the registered tools.

Example queries:
- List registered routes and controllers.
- Retrieve recent runtime errors or unhandled rejections.
- Inspect failed HTTP requests and durations.
- Check current environment variables and configuration.

---

## Tools

| Tool | Description |
| :--- | :--- |
| `discover_servers` | Scans localhost ports for running NestJS instances. |
| `get_routes` | Lists registered HTTP routes, controllers, methods, and handler names. |
| `get_logs` | Retrieves buffered runtime logs with level and correlation ID filtering. |
| `get_errors` | Returns recent runtime errors, bootstrap failures, and 5xx responses with stack traces. |
| `get_request_history` | Returns recent HTTP requests with duration, status code, method, and correlation ID. |
| `get_config` | Reads configuration from `process.env` and `ConfigService`. |

---

## Security

- **Localhost only**: Endpoints check `socket.remoteAddress` and reject non-localhost requests.
- **Disabled in production**: The preload hook does not activate when `NODE_ENV=production`.
- **Secret masking**: Values matching credential patterns (passwords, tokens, database URLs, auth headers, private keys) are replaced with `***MASKED***`.

---

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm ci
```

---

## License

[MIT](LICENSE) © HaoNgo232
