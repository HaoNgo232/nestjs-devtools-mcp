# 03: Modernize Routes and Configuration Inspection Tools

**What to build:**
Upgrade application inspection capabilities with standardized `nestjs_get_routes` and `nestjs_get_config` tools. Implement runtime parameter validation using Zod, enforce tool annotations, and deliver readable hierarchical Markdown views alongside structured content for route trees and sanitized configuration keys.

**Blocked by:** 01: Core Migration to McpServer & Modular Architecture

**Status:** completed

- [x] Tools registered as `nestjs_get_routes` and `nestjs_get_config` via `server.registerTool`
- [x] Zod validation schemas implemented for filters (port, methods, config sources, key prefixes)
- [x] Tool annotations declared (`readOnlyHint: true`, `idempotentHint: true`)
- [x] Comprehensive tool descriptions written including clear examples and error scenarios
- [x] Markdown response format presents route endpoints grouped by Controller and config keys with masked secrets
- [x] Structured content is returned alongside text content for programmatic processing
- [x] Helpful, actionable error guidance returned when targeted NestJS server is not reachable
- [x] Unit tests verify schema parsing, proxy forwarding, and dual response formatting
