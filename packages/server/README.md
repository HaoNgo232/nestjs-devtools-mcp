# nestjs-devtools-mcp

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

## Available MCP Features

### Tools

- `discover_servers`: Scan localhost and list NestJS apps with plugin enabled.
- `get_logs`: Fetch buffered runtime logs.
- `get_routes`: Fetch registered HTTP routes.
- `get_request_history`: Fetch recent HTTP request history with filters for method, status, path, duration, and errors.
- `get_config`: Fetch sanitized runtime configuration from environment variables and ConfigService.

`get_request_history` is useful for checking whether frontend traffic reached the server, finding slow endpoints, and inspecting recent 4xx/5xx responses. The plugin excludes internal `/_dev/mcp/*` traffic from the history.

`get_config` is read-only. Values that look like secrets are always returned as `***MASKED***`.

### Prompts

- `install_nestjs_devtools_mcp`: Quickstart prompt for setting up plugin + MCP client config.

### Resources

- `nestjs-devtools://runtime-guide`: Machine-readable JSON runtime/setup guide.

## 🔌 How it Works

The bridge automatically scans local ports (`3000-3010`) to find any running NestJS application that has the `@nestjs-devtools-mcp/plugin` installed. Once found, it proxies MCP tool calls over HTTP to the plugin.

---

## 🛡️ Requirements

- NestJS application must have `@nestjs-devtools-mcp/plugin` imported.
- Bridge only connects to `localhost` endpoints for security.
- Request body capture is disabled by default in the plugin. Enable `captureRequestBody` only for local debugging; multipart bodies are never captured.
- Config values that look like secrets are masked before they are returned by `get_config`.

## License

MIT

For detailed documentation, visit the [Main README](https://github.com/HaoNgo232/nestjs-devtools-mcp).
