# nestjs-devtools-mcp

> Zero-code **Model Context Protocol (MCP)** server for **NestJS**.  
> Empower your AI coding assistants (**Cursor**, **Claude Desktop**, **Claude Code**, **Windsurf**, **Cline**) with live runtime logs, registered routes, request history, errors, and configuration.

[![npm version](https://img.shields.io/npm/v/nestjs-devtools-mcp.svg)](https://www.npmjs.com/package/nestjs-devtools-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## How It Works

```
   AI Client (Cursor / Claude)
              │
              │  MCP over STDIO
              ▼
     nestjs-devtools-mcp (Bridge)
              │
              │  HTTP over localhost
              ▼
  Running NestJS App (Zero-Code Preload)
```

No code modifications required in your NestJS codebase. Your AI assistant connects directly to your live development server via local runtime introspection.

---

## Step-by-Step Setup

Follow these 4 simple steps to connect your AI assistant to any NestJS project:

### Step 1: Configure Your AI Client (Once per machine)

Add the `nestjs-devtools` MCP server to your AI editor or client settings.

#### For Cursor (`~/.cursor/mcp.json` or project `.cursor/mcp.json`)
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

#### For Claude Desktop
Add to your `claude_desktop_config.json`:
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

#### For Claude Code CLI
```bash
claude mcp add nestjs-devtools -- npx -y nestjs-devtools-mcp@latest
```

---

### Step 2: Enable MCP in Your NestJS Project

Navigate into your existing NestJS project directory and run:

```bash
cd /path/to/your-nestjs-app
npx nestjs-devtools-mcp init
```

**What this does:**
- Appends `NODE_OPTIONS="--require nestjs-devtools-mcp/register"` to `.env.local`
- Ensures `.env.local` is ignored in `.gitignore`
- **Zero code changes:** You never modify `app.module.ts`, `main.ts`, or add third-party dependencies to `package.json`.

*(Alternative: On-demand runner without any file changes)*
```bash
npx nestjs-devtools-mcp run -- npm run start:dev
```

---

### Step 3: Start Your NestJS Application

Start your dev server using your normal daily workflow:

```bash
npm run start:dev
# or: pnpm start:dev / yarn start:dev
```

The preload hook automatically attaches in memory, captures runtime logs, and exposes secure localhost inspection endpoints.

---

### Step 4: Ask Your AI Assistant!

Your AI assistant can now use the following tools in real time:

- *"What routes are currently registered in my NestJS app?"*
- *"Show me the recent runtime errors and unhandled exceptions."*
- *"Why did the request to `/api/orders` fail with HTTP 500?"*
- *"Inspect recent HTTP requests and find slow queries taking over 200ms."*
- *"Check the current environment and configuration values."*

---

## Available MCP Tools

| Tool | Description |
| :--- | :--- |
| `discover_servers` | Automatically scans localhost ports for running NestJS instances. |
| `get_routes` | Lists all registered HTTP routes with methods, paths, controllers, and handler names. |
| `get_logs` | Retrieves buffered application runtime logs with level (`error`, `warn`, `log`, `debug`) and request ID filtering. |
| `get_errors` | Returns recent runtime errors, bootstrap crashes, unhandled rejections, and HTTP 5xx responses with stack traces. |
| `get_request_history` | Inspects recent HTTP requests with duration, status code, method, and correlation ID. |
| `get_config` | Dumps runtime configuration from `process.env` and `@nestjs/config` `ConfigService`. |

---

## Security Model

Built with security best practices for local development:

- **Localhost Guard**: All endpoints are protected by `LocalhostOnlyGuard` and only accessible from the local machine.
- **Production Disabled**: The preload hook and devtools plugin automatically disable when `NODE_ENV=production`.
- **Automatic Secret Masking**: Passwords, API tokens, JWTs, database URLs, authorization headers, private keys, cookies, and session secrets are automatically masked as `***MASKED***`.

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run test suite
pnpm test

# Run full CI check (format, lint, build, test)
pnpm ci
```

---

## License

[MIT](LICENSE) © HaoNgo232
