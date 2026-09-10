# 01: Core Migration to McpServer & Modular Architecture

**What to build:**
Upgrade the MCP server core infrastructure from low-level manual request handlers to the modern `@modelcontextprotocol/sdk` high-level `McpServer` interface. Restructure the server package into clean, maintainable domain modules (tools, schemas, types). Migrate existing prompts and resources to modern registration APIs while maintaining STDIO communication and passing baseline tests.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Server initializes via `McpServer` class with proper metadata (name, version)
- [x] Server package codebase is organized into domain-specific modules
- [x] Runtime guide resource is registered using `server.registerResource`
- [x] Quickstart setup prompt is registered using `server.registerPrompt`
- [x] STDIO transport successfully connects and communicates with clients
- [x] Existing core unit tests pass on top of the modern SDK foundation
