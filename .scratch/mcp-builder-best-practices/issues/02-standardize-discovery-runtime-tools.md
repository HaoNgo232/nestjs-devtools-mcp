# 02: Standardize Discovery & Runtime Tools (nestjs_discover_servers)

**What to build:**
Deliver the standardized `nestjs_discover_servers` tool for locating active NestJS applications running the DevTools plugin. The tool uses the modern `server.registerTool` API, enforces input validation via Zod, supplies behavioral annotations, and provides dual-format responses (structured JSON for code/tools and human-friendly Markdown tables for agent reading).

**Blocked by:** 01: Core Migration to McpServer & Modular Architecture

**Status:** completed

- [x] Tool is registered under the standardized name `nestjs_discover_servers`
- [x] Schema is defined with Zod with field descriptions and constraints
- [x] Tool annotations are declared (`readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`)
- [x] Detailed agent-first tool description is provided with usage guidelines and examples
- [x] Output supports both Markdown summary (displaying PID, port, version, uptime) and JSON structured content
- [x] Actionable error message is returned when scanning encounters unexpected failures
- [x] Unit tests verify end-to-end tool registration, execution, and output formats
