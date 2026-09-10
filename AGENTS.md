# Repository Guidelines

## Project Structure & Module Organization

This is a Bun workspace monorepo with two published packages and test applications:

- `packages/plugin`: `@nestjs-devtools-mcp/plugin`, a NestJS module that runs inside the target app and exposes `/_dev/mcp`.
- `packages/server`: `nestjs-devtools-mcp`, an MCP STDIO bridge built with `@modelcontextprotocol/sdk` (`McpServer`). Discovers and proxies requests to local plugin endpoints.
- `test-nestjs-app`: minimal fixture app used for development and testing.

Source files live in each package's `src/`. In `packages/server`, code is modularized into `src/tools/`, `src/schemas/`, `src/types.ts`, and `src/constants.ts`. Unit tests live beside source files under `src/__tests__/`.

## Build, Test, and Development Commands

Use Bun from the repository root:

- `bun install`: install workspace dependencies.
- `bun run build`: build all workspace packages with TypeScript.
- `bun run test`: run Jest test suites across all packages.
- `bun run lint`: lint all TypeScript files using `eslint.config.mjs`.
- `bun run format`: format TypeScript files with Prettier.
- `bun run ci`: execute format, lint, build, and test pipeline.

Package-scoped commands:
- `bun run --filter @nestjs-devtools-mcp/plugin test`
- `bun run --filter nestjs-devtools-mcp test`
- `bun run --filter nestjs-devtools-mcp build`

## Coding Style & Naming Conventions

- Write idiomatic TypeScript with strict types.
- Follow NestJS conventions in `packages/plugin`: services end in `.service.ts`, controllers in `.controller.ts`, guards in `.guard.ts`, and specs in `.spec.ts`.
- In `packages/server`, use modern MCP SDK APIs (`McpServer`, `server.registerTool`, `server.registerResource`, `server.registerPrompt`). Define schemas with Zod and declare tool annotations (`readOnlyHint`, `idempotentHint`).
- Prefix all standardized MCP tools with `nestjs_` (e.g. `nestjs_discover_servers`, `nestjs_get_logs`).
- ESLint enforces: no unused variables unless prefixed with `_`, no explicit `any` outside tests, and no non-null assertions.

## Architecture & Boundaries

- Maintain strict package boundaries:
  - `packages/plugin` may import `@nestjs/*`, but must NEVER import the MCP SDK.
  - `packages/server` may import `@modelcontextprotocol/sdk`, but must NEVER import `@nestjs/*`.
  - The server connects exclusively via STDIO and must not start an HTTP listener.
- The plugin must be transparent and safe: forward logs to the original logger, disable by default in production (`NODE_ENV=production`), and restrict `/_dev/mcp` to localhost only.
- Keep user setup zero-code: prioritize auto-discovery and sensible defaults over required configuration options.

## Commit & Pull Request Guidelines

- Use Conventional Commit prefixes: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Keep commits atomic and focused on single behavioral slices.
- Verify that `bun run test` passes cleanly before submitting changes.
