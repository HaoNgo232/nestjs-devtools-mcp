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

Add the following configuration to your AI client (Cursor, Claude Desktop, Windsurf, Cline, etc.):

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

**Where to add this:**
- **Cursor**: In `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project-level)
- **Claude Desktop**: In `claude_desktop_config.json`:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`
- **Claude Code CLI** (alternative to manual JSON editing):
  ```bash
  claude mcp add nestjs-devtools -- npx -y nestjs-devtools-mcp@latest
  ```

---

### 2. Enable in Your NestJS Project

Open a terminal, navigate (`cd`) into your NestJS project folder (the folder containing `package.json`), and run:

```bash
cd /path/to/my-nestjs-app
npx nestjs-devtools-mcp init
```

This appends `NODE_OPTIONS="--require nestjs-devtools-mcp/register"` to `.env.local` and adds `.env.local` to `.gitignore`. No TypeScript source files are modified.

Alternatively, run on demand without creating any configuration files:

```bash
npx nestjs-devtools-mcp run -- npm run start:dev
```

---

### 3. Start the Application

In your NestJS project folder, start the development server as usual:

```bash
npm run start:dev
```

The preload hook attaches during startup, enables log buffering, and exposes local inspection endpoints on localhost.

---

### 4. Query via AI Client

Your AI client can now query runtime state using the available MCP tools.

Example queries:
- List registered routes, HTTP methods, and controllers.
- Retrieve recent runtime errors or unhandled rejections.
- Inspect failed HTTP requests, status codes, and latencies.
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
