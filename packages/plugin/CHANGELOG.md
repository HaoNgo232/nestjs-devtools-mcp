# @nestjs-devtools-mcp/plugin

## 0.3.0

### Minor Changes

- add `get_errors` tool for categorizing and retrieving runtime errors (`bootstrap`, `runtime`, `unhandled`, `http-5xx`)
- add `ErrorBufferService` circular buffer for capturing uncaught exceptions, unhandled rejections, and bootstrap errors
- add `UnhandledErrorListener` for process listener management and error serialization
- support stack trace masking in production environment

## 0.2.3


### Patch Changes

- add `get_request_history` with transparent HTTP request capture, filters, 404 fallback recording, and internal MCP request exclusion
- add `get_config` with runtime env/config inspection and non-disableable secret masking

## 0.1.11

### Patch Changes

- chore: bump versions to 0.1.10, integrate changesets, and sync package versions via JSON imports
