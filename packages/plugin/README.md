# @nestjs-devtools-mcp/plugin

NestJS plugin for exposing local runtime diagnostics to AI coding agents through NestJS DevTools MCP.

This package runs inside your NestJS app and exposes a localhost-only internal endpoint that the `nestjs-devtools-mcp` bridge can read from.

---

## Features

- Runtime log buffering
- HTTP route discovery
- HTTP request history
- Sanitized runtime config inspection
- Runtime error tracking
- Request correlation ID support
- Localhost-only access guard
- Disabled by default in production
- Transparent logger forwarding

---

## Installation

```bash
npm install @nestjs-devtools-mcp/plugin
```

Or:

```bash
pnpm add @nestjs-devtools-mcp/plugin
```

---

## Basic Setup

Register the module in your application module:

```ts
import { Module } from '@nestjs/common'
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin'

@Module({
  imports: [DevtoolsMcpModule.register()],
})
export class AppModule {}
```

Use `bufferLogs: true` during bootstrap so startup logs can be captured reliably:

```ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })

  await app.listen(3000)
}

bootstrap()
```

The custom DevTools logger is automatically applied when the module is registered.

---

## Configuration

```ts
DevtoolsMcpModule.register({
  name: 'my-nest-api',
  logBufferSize: 500,
  requestHistorySize: 100,
  errorBufferSize: 100,
})
```

| Option               | Default                                | Description                          |
| -------------------- | -------------------------------------- | ------------------------------------ |
| `name`               | Auto-detected from host `package.json` | Name reported to the bridge          |
| `disabled`           | `true` when `NODE_ENV=production`      | Disable the plugin                   |
| `logBufferSize`      | `500`                                  | Maximum buffered log entries         |
| `requestHistorySize` | `100`                                  | Maximum HTTP request history entries |
| `errorBufferSize`    | `100`                                  | Maximum runtime error entries        |

To force-disable the plugin:

```ts
DevtoolsMcpModule.register({
  disabled: true,
})
```

---

## Exposed Local Endpoint

The plugin exposes:

```txt
GET  /_dev/mcp/health
POST /_dev/mcp/tools/get_logs
POST /_dev/mcp/tools/get_routes
POST /_dev/mcp/tools/get_request_history
POST /_dev/mcp/tools/get_config
POST /_dev/mcp/tools/get_errors
```

These endpoints are protected by `LocalhostOnlyGuard` and only allow local requests from:

```txt
127.0.0.1
::1
::ffff:127.0.0.1
```

---

## Runtime Data Collected

### Logs

Captured from NestJS logger calls:

```ts
private readonly logger = new Logger('UsersController')

this.logger.log('User created')
this.logger.error('Database failed')
```

Available through the MCP tool:

```txt
get_logs
```

---

### Routes

The plugin uses NestJS discovery APIs to list registered HTTP routes:

```txt
get_routes
```

Returned route fields include:

- HTTP method
- Path
- Controller name
- Handler name

Internal DevTools routes are excluded.

---

### Request History

The plugin captures recent HTTP traffic:

```txt
get_request_history
```

Returned fields include:

- Method
- Path
- Route pattern
- Status code
- Duration
- Controller and handler
- Request size
- Response size
- Error metadata
- Request correlation ID

Request bodies and response bodies are not captured.

Internal `/_dev/mcp/*` calls are excluded.

---

### Config

The plugin can inspect sanitized runtime config:

```txt
get_config
```

Sources:

- `process.env`
- Selected keys from `@nestjs/config` `ConfigService`

Sensitive values are always masked.

To expose selected `ConfigService` keys, set:

```bash
NESTJS_MCP_CONFIG_KEYS=APP_NAME,DATABASE_HOST,FEATURE_FLAG
```

The plugin does not reflectively dump the entire internal `ConfigService` state.

---

### Errors

The plugin tracks runtime errors from several sources:

```txt
get_errors
```

Supported sources:

| Source      | Meaning                                              |
| ----------- | ---------------------------------------------------- |
| `bootstrap` | Errors during application bootstrap                  |
| `runtime`   | Error-level NestJS logs                              |
| `unhandled` | Uncaught exceptions and unhandled promise rejections |
| `http-5xx`  | Failed HTTP requests with 5xx status codes           |

Stack traces are masked in production.

---

## Security Defaults

This plugin is intended for local development.

By default:

- It is disabled when `NODE_ENV=production`
- It only accepts localhost requests
- It does not capture request or response bodies
- Config secrets are always masked
- `ConfigService` keys must be explicitly declared
- DevTools internal calls are excluded from request history

Example masked output:

```json
{
  "key": "DATABASE_URL",
  "value": "***MASKED***",
  "masked": true
}
```

---

## Using With an MCP Client

This package does not implement MCP STDIO transport directly.

Use the bridge package in your MCP client:

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

---

## Troubleshooting

### No server is discovered

Check that:

1. Your NestJS app is running
2. `DevtoolsMcpModule.register()` is imported
3. The app is listening on a scanned port
4. `NODE_ENV` is not `production`
5. The MCP client was restarted after config changes

### Logs are missing

Use `bufferLogs: true`:

```ts
const app = await NestFactory.create(AppModule, {
  bufferLogs: true,
})
```

### ConfigService values are missing

Declare keys explicitly:

```bash
NESTJS_MCP_CONFIG_KEYS=APP_NAME,DATABASE_HOST
```

### Endpoint returns 403

The endpoint only allows localhost requests. Make sure the MCP bridge and NestJS app run on the same machine or are networked so the request appears as localhost.

---

## License

MIT
