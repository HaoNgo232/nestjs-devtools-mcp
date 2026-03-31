# nestjs-devtools-mcp (Bridge Server)

**The CLI Bridge for NestJS DevTools MCP**

This package is a standalone bridge that allows AI coding agents (Claude, Cursor, etc.) to securely communicate with a running NestJS application through the Model Context Protocol (MCP).

---

## 🚀 Usage

You don't need to manually install this package. You can run it directly using `npx` in your MCP client configuration:

### 1. Configure MCP Client (Claude Desktop / Cursor)

Add the following entry to your `mcp_settings.json`:

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

## 🔌 How it Works

The bridge automatically scans local ports (`3000-3010`) to find any running NestJS application that has the `@nestjs-devtools-mcp/plugin` installed. Once found, it proxies MCP tool calls over HTTP to the plugin.

### Key Tools Provided:
- `discover_servers`: List active NestJS apps with the plugin.
- `get_logs`: Fetch latest logs from circular buffer.
- `get_routes`: View all registered API endpoints (coming soon).

---

## 🛡️ Requirements
- NestJS application must have `@nestjs-devtools-mcp/plugin` imported.
- Bridge only connects to `localhost` endpoints for security.

For detailed documentation, visit the [Main README](https://github.com/HaoNgo232/nestjs-devtools-mcp).
