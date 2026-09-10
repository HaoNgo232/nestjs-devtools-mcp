# nestjs-devtools-mcp

Model Context Protocol (MCP) server that connects AI clients to NestJS applications over STDIO. Discovers running local instances and proxies runtime requests to localhost HTTP endpoints.

[![npm version](https://img.shields.io/npm/v/nestjs-devtools-mcp.svg)](https://www.npmjs.com/package/nestjs-devtools-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Usage

### 1. Configure in MCP Client

Add this server to your AI editor or client settings:

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

Config file locations:
- **Cursor**: `~/.cursor/mcp.json` or `.cursor/mcp.json` in your project
- **Claude Desktop**: `claude_desktop_config.json`
- **Claude Code CLI**: `claude mcp add nestjs-devtools -- npx -y nestjs-devtools-mcp@latest`

---

### 2. Enable in NestJS Project

Navigate to your NestJS project folder and run:

```bash
cd /path/to/my-nestjs-app
npx nestjs-devtools-mcp init
```

This appends `NODE_OPTIONS="--require nestjs-devtools-mcp/register"` to `.env.local` and adds `.env.local` to `.gitignore`.

Alternatively, run without modifying configuration files:

```bash
npx nestjs-devtools-mcp run -- npm run start:dev
```

---

### 3. Start Development Server

```bash
npm run start:dev
```

When started, the preload hook injects local endpoints into the application process.

---

## Exposed MCP Tools

| Tool | Description |
| :--- | :--- |
| `discover_servers` | Scans localhost for running NestJS instances. |
| `get_routes` | Lists registered HTTP routes, controllers, methods, and handler names. |
| `get_logs` | Retrieves buffered runtime logs with level and correlation ID filtering. |
| `get_errors` | Returns recent runtime errors, bootstrap crashes, and 5xx responses with stack traces. |
| `get_request_history` | Returns recent HTTP requests with duration, status code, method, and correlation ID. |
| `get_config` | Reads configuration from `process.env` and `@nestjs/config` `ConfigService`. |

---

## Security

- Restricted to local requests using a localhost guard.
- Preload hook is disabled when `NODE_ENV=production`.
- Secrets matching common credential patterns are masked as `***MASKED***`.

---

## License

[MIT](LICENSE) © HaoNgo232
