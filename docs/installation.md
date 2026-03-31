# Installation & Usage Guide

This document provides detailed instructions for installing the NestJS DevTools MCP, covering both standard users (via NPM) and developers (via Local Repository).

---

## 🛠 Standard Installation (NPM)

For most users, follow the **Quick Start** guide in the main [**README.md**](../README.md).

1. Install `@nestjs-devtools-mcp/plugin`.
2. Register `DevtoolsMcpModule.register()` in your `AppModule`.
3. Configure your MCP Client (Claude Desktop/Cursor) to use `npx -y nestjs-devtools-mcp@latest`.

---

## 🏗 Installation for Developers (Local Repository)

If you are contributing to this project or want to use the latest unreleased features directly from the source code, follow these steps.

### Step 1: Build the Repository
First, clone the repository and build both the plugin and the server packages:
```bash
cd /path/to/nestjs-devtools-mcp
npm install
npm run build --workspaces
```

### Step 2: Link the Plugin to your NestJS App
In your target NestJS application's root directory, install the plugin using the absolute path to its folder:
```bash
# Example
npm install /home/user/projects/nestjs-devtools-mcp/packages/plugin
```
*Note: This creates a direct dependency on your local build of the plugin.*

### Step 3: Register the Module (Standard)
```typescript
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin';

@Module({
  imports: [DevtoolsMcpModule.register()],
})
export class AppModule {}
```

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

## 💡 Troubleshooting & Notes

- **Port Range**: The Bridge CLI automatically scans ports `3000-3010`. If your NestJS app runs on a different port, ensure it falls within this range or wait for the `--port` configuration update in Phase 2.
- **Security Check**: The plugin only allows connections from `127.0.0.1` and `::1`. If you are running inside a container, ensure the network mode is `host` or the bridge IP is correctly mapped (refer to `LocalhostOnlyGuard` for implementation details).
- **Production Mode**: The plugin is disabled by default if `NODE_ENV === 'production'`. To force enable it (not recommended), use `DevtoolsMcpModule.register({ disabled: false })`.
