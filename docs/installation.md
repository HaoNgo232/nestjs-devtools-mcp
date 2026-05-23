# Installation & Usage Guide

This document provides detailed instructions for installing the NestJS DevTools MCP, covering both standard users (via NPM) and developers (via Local Repository).

---

## Standard Installation (NPM)

For most users, follow the **Quick Start** guide in the main [**README.md**](../README.md).

1. Install `@nestjs-devtools-mcp/plugin`.
2. Register `DevtoolsMcpModule.register()` in your `AppModule`.
3. Configure your MCP Client (Claude Desktop/Cursor) to use `npx -y nestjs-devtools-mcp@latest`.

Available MCP tools:

- `discover_servers`: Scan localhost and list NestJS apps with plugin enabled.
- `get_logs`: Fetch buffered runtime logs.
- `get_routes`: Fetch registered HTTP routes.
- `get_request_history`: Fetch recent HTTP request history with filters for method, status, path, duration, and errors.
- `get_config`: Fetch sanitized runtime configuration from environment variables and ConfigService.

`get_request_history` records the recent HTTP requests processed by the app, including unmatched 404 responses. It does not record request bodies, response bodies, or internal `/_dev/mcp/*` tool calls by default.

`get_config` reads from `process.env` and, when available, `@nestjs/config`'s `ConfigService`. Sensitive keys and sensitive-looking values are always masked and there is no option to disable masking.

---

## Configuring Specific MCP Clients

Here is how to add the NestJS DevTools MCP to the most popular AI coding assistants:

### 1. Claude Desktop

To use it with Claude Desktop, you need to add the server configuration to your `claude_desktop_config.json` file.

* **Config File Location**:
  * **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
  * **Windows**: `%APPDATA%\Claude\claude_desktop_config.json` (e.g., `C:\Users\<YourUsername>\AppData\Roaming\Claude\claude_desktop_config.json`)
  * **Linux**: `~/.config/Claude/claude_desktop_config.json`

* **Configuration**:
  Add this under the `mcpServers` object:
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

### 2. Cursor

In Cursor, you configure MCP servers directly through the user interface:

1. Open Cursor and go to **Settings** (Gear icon in top right) -> **Cursor Settings**.
2. Navigate to **Features** -> **MCP**.
3. Click the **+ Add New MCP Server** button.
4. Fill in the fields:
   * **Name**: `nestjs-devtools`
   * **Type**: `command`
   * **Command**: `npx -y nestjs-devtools-mcp@latest` (or `npx` for command, and `-y`, `nestjs-devtools-mcp@latest` in the arguments field if separated).
5. Click **Save** and verify that the server status turns green (Connected).

### 3. VS Code Extensions (Cline, Roo Code)

If you are using VS Code extensions like **Cline** or **Roo Code (formerly Roo Cline)**:

1. Click on the extension icon in the VS Code sidebar.
2. Open the extension **Settings** (Gear icon inside the extension panel).
3. Under the **MCP Mode** or **MCP Servers** section, configure the new server:
   * Edit the `cline_mcp_settings.json` file (usually linked in settings or located at `~/.code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` / `roocode_mcp_settings.json`).
   * Add the configuration:
     ```json
     {
       "mcpServers": {
         "nestjs-devtools": {
           "command": "npx",
           "args": ["-y", "nestjs-devtools-mcp@latest"],
           "disabled": false
         }
       }
     }
     ```

---

## Installation for Developers (Local Repository)

If you are contributing to this project or want to use the latest unreleased features directly from the source code, follow these steps.

### Step 1: Build the Repository
First, clone the repository and build both the plugin and the server packages:
```bash
cd /path/to/nestjs-devtools-mcp
pnpm install && pnpm build
```

### Step 2: Link the Plugin to your NestJS App
In your target NestJS application's root directory, install the plugin using the absolute path to its folder:
```bash
pnpm add /path/to/nestjs-devtools-mcp/packages/plugin
```
This creates a direct dependency on your local build of the plugin.

### Step 3: Register the Module (Standard)
```typescript
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin';

@Module({
  imports: [DevtoolsMcpModule.register()],
})
export class AppModule {}
```
Configuration values that look like secrets are masked before they are returned by `get_config`, and masking cannot be disabled.

### Step 4: Configure MCP Client to use Local Bridge
Instead of using `npx`, point your MCP client directly to the compiled entry point of your local server package:
```json
{
  "mcpServers": {
    "nestjs-devtools-local": {
      "command": "node",
      "args": ["/path/to/nestjs-devtools-mcp/packages/server/dist/index.js"]
    }
  }
}
```

---

## Troubleshooting & Notes

- **Port Range & Environment Variables**: The Bridge CLI scans ports `3000-3010` by default. You can customize the scan range using `NESTJS_MCP_SCAN_START` and `NESTJS_MCP_SCAN_END` environment variables.
- **Custom Global Prefix**: If your application uses a global route prefix (e.g. `app.setGlobalPrefix('api')`), configure the bridge to scan this prefix using the `NESTJS_MCP_PREFIX` environment variable (e.g. `NESTJS_MCP_PREFIX=api`).
- **Security Check**: The plugin only allows connections from `127.0.0.1` and `::1`. If you are running inside a container, ensure the network mode is `host` or the bridge IP is correctly mapped (refer to `LocalhostOnlyGuard` for implementation details).
- **Production Mode**: The plugin is disabled by default if `NODE_ENV === 'production'`. To force enable it (not recommended), use `DevtoolsMcpModule.register({ disabled: false })`.
- **Config Secrets**: The config tool masks values that look like secrets before returning them, which cannot be disabled.
- **Config Service Keys**: By default, `get_config` does not read from NestJS `ConfigService` to prevent accidental exposure of variables. You must explicitly declare the keys you want to expose in the `NESTJS_MCP_CONFIG_KEYS` environment variable as a comma-separated list (e.g. `NESTJS_MCP_CONFIG_KEYS=APP_NAME,DATABASE_HOST`).
- **Request History Scope**: `get_request_history` records HTTP traffic only. It does not capture WebSocket, gRPC, or Nest microservice transports.
- **Config Scope**: `get_config` is read-only. It does not modify runtime config and does not fetch values from databases, Redis, or external config stores.
