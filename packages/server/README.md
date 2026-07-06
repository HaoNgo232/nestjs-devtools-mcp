# nestjs-devtools-mcp

MCP STDIO bridge for NestJS DevTools MCP.

This package is launched by AI clients such as Claude, Cursor, Cline, Roo Code, or Copilot-compatible MCP clients. It discovers local NestJS apps using `@nestjs-devtools-mcp/plugin` and proxies MCP tool calls to the plugin over localhost HTTP.

---

## What This Package Does

- Starts an MCP server over STDIO
- Scans local ports for NestJS apps with the plugin enabled
- Exposes tools to AI clients
- Proxies requests to `/_dev/mcp/tools/*`
- Does not start an HTTP server
- Does not import NestJS packages

---

## Usage

You usually do not install this package manually.

Configure your MCP client to run it with `npx`:

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

Restart your MCP client after saving the configuration.

---

## Required NestJS Setup

Your NestJS app must install and register the plugin package:

```bash
npm install @nestjs-devtools-mcp/plugin
```

```ts
import { Module } from '@nestjs/common'
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin'

@Module({
  imports: [DevtoolsMcpModule.register()],
})
export class AppModule {}
```

Recommended bootstrap setup:

```ts
const app = await NestFactory.create(AppModule, {
  bufferLogs: true,
})
```

---

## Available Tools

### `discover_servers`

Find local NestJS servers with the DevTools plugin enabled.

Example prompt:

```txt
Discover my local NestJS servers.
```

---

### `get_logs`

Read recent runtime logs.

Arguments:

| Argument    | Type   | Description                                          |
| ----------- | ------ | ---------------------------------------------------- |
| `port`      | number | Optional NestJS server port                          |
| `lines`     | number | Number of log entries                                |
| `level`     | string | `all`, `log`, `error`, `warn`, `debug`, or `verbose` |
| `requestId` | string | Optional correlation ID                              |

Example prompt:

```txt
Show the last 50 error logs from my NestJS app.
```

---

### `get_routes`

List registered HTTP routes.

Arguments:

| Argument | Type   | Description                 |
| -------- | ------ | --------------------------- |
| `port`   | number | Optional NestJS server port |

Example prompt:

```txt
List all routes registered in my NestJS server.
```

---

### `get_request_history`

Read recent HTTP request history.

Arguments:

| Argument        | Type    | Description                                |
| --------------- | ------- | ------------------------------------------ |
| `port`          | number  | Optional NestJS server port                |
| `limit`         | number  | Number of entries, default `50`, max `200` |
| `method`        | string  | Filter by HTTP method                      |
| `statusCode`    | number  | Filter by exact status code                |
| `statusClass`   | string  | `2xx`, `3xx`, `4xx`, or `5xx`              |
| `pathContains`  | string  | Filter by path substring                   |
| `minDurationMs` | number  | Filter slow requests                       |
| `onlyErrors`    | boolean | Return failed requests only                |
| `requestId`     | string  | Optional correlation ID                    |

Example prompt:

```txt
Show failed requests from my NestJS app and explain what might be wrong.
```

---

### `get_config`

Inspect sanitized runtime configuration.

Arguments:

| Argument        | Type    | Description                       |
| --------------- | ------- | --------------------------------- |
| `port`          | number  | Optional NestJS server port       |
| `source`        | string  | `all`, `env`, or `config-service` |
| `keyContains`   | string  | Filter config keys                |
| `includeMasked` | boolean | Include masked entries            |

Example prompt:

```txt
Show runtime config keys containing DATABASE.
```

Sensitive values are always masked by the plugin.

---

### `get_errors`

Read recent runtime errors.

Arguments:

| Argument        | Type    | Description                                        |
| --------------- | ------- | -------------------------------------------------- |
| `port`          | number  | Optional NestJS server port                        |
| `limit`         | number  | Number of entries, default `50`, max `200`         |
| `source`        | string  | `bootstrap`, `runtime`, `unhandled`, or `http-5xx` |
| `since`         | number  | Unix timestamp in milliseconds                     |
| `requestId`     | string  | Optional correlation ID                            |
| `onlyUnhandled` | boolean | Return only unhandled and bootstrap errors         |
| `includeStack`  | boolean | Include stack traces when allowed                  |

Example prompt:

```txt
Show recent unhandled errors and HTTP 5xx errors in my NestJS app.
```

---

## Prompts

This bridge exposes one built-in MCP prompt:

```txt
install_nestjs_devtools_mcp
```

It provides quick setup instructions for installing the plugin and configuring an MCP client.

---

## Resources

This bridge exposes one MCP resource:

```txt
nestjs-devtools://runtime-guide
```

It returns a machine-readable JSON guide describing setup, available tools, and security behavior.

---

## Environment Variables

| Variable                 | Default | Description                                           |
| ------------------------ | ------- | ----------------------------------------------------- |
| `NESTJS_MCP_SCAN_START`  | `3000`  | First port to scan                                    |
| `NESTJS_MCP_SCAN_END`    | `3010`  | Last port to scan                                     |
| `NESTJS_MCP_PREFIX`      | empty   | Prefix used when discovering the health endpoint      |
| `NESTJS_MCP_CONFIG_KEYS` | empty   | Comma-separated ConfigService keys read by the plugin |

Example:

```bash
NESTJS_MCP_SCAN_START=3000 NESTJS_MCP_SCAN_END=3010 npx nestjs-devtools-mcp
```

---

## Server Discovery

By default, the bridge scans:

```txt
localhost:3000
localhost:3001
...
localhost:3010
```

It calls:

```txt
GET /_dev/mcp/health
```

A server is considered valid when the response identifies itself as:

```txt
nestjs-devtools-mcp
```

If exactly one server is found, tools use it automatically.

If multiple servers are found, provide the `port` argument.

---

## Troubleshooting

### MCP client says the server disconnected

Make sure your MCP config uses:

```json
{
  "command": "npx",
  "args": ["-y", "nestjs-devtools-mcp@latest"]
}
```

Then restart the MCP client.

---

### No NestJS server found

Check that:

1. Your NestJS app is running
2. The plugin is installed and registered
3. The app port is within the scan range
4. The plugin is not disabled by `NODE_ENV=production`
5. The health endpoint responds locally:

```bash
curl http://localhost:3000/_dev/mcp/health
```

---

### Multiple servers found

Pass the target port when calling tools:

```json
{
  "port": 3000
}
```

---

### Tool calls return 403

The plugin only accepts localhost requests. Ensure the bridge is running on the same machine as the NestJS app.

---

## Development

From the monorepo root:

```bash
pnpm install
pnpm build
pnpm test
```

Run only this package:

```bash
pnpm --filter nestjs-devtools-mcp build
pnpm --filter nestjs-devtools-mcp test
```

---

## License

MIT
