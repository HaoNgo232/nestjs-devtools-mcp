# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm monorepo with two published packages and local apps:

- `packages/plugin`: `@nestjs-devtools-mcp/plugin`, a NestJS module that runs inside the user app and exposes `/_dev/mcp`.
- `packages/server`: `nestjs-devtools-mcp`, a lightweight MCP STDIO bridge that discovers and proxies to local plugin endpoints.
- `demo-app`: local NestJS demo for manual integration checks.
- `test-nestjs-app`: minimal fixture app for development.
- `docs`: installation and development documentation.

Source files live in each package’s `src`. Unit tests live beside source under `src/__tests__` or collector-specific `__tests__` directories.

## Build, Test, and Development Commands

Use pnpm from the repository root:

- `pnpm install`: install workspace dependencies.
- `pnpm run build`: build all workspace packages with TypeScript.
- `pnpm run test`: run Jest tests in each package.
- `pnpm run lint`: lint all TypeScript files using `eslint.config.mjs`.
- `pnpm run format`: format TypeScript files with Prettier.
- `pnpm run ci`: run format, lint, build, and tests.
- `pnpm --filter @nestjs-devtools-mcp/plugin publish --access public`: publish the NestJS plugin package.
- `pnpm --filter nestjs-devtools-mcp publish --access public`: publish the MCP bridge package.

Package-scoped examples: `pnpm --filter @nestjs-devtools-mcp/plugin test` and `pnpm --filter nestjs-devtools-mcp build`.

## Coding Style & Naming Conventions

Write TypeScript and follow existing NestJS naming in `packages/plugin`: services end in `.service.ts`, controllers in `.controller.ts`, guards in `.guard.ts`, and specs in `.spec.ts`. Keep bridge files in `packages/server` framework-free.

ESLint forbids unused variables unless prefixed with `_`, forbids explicit `any` outside tests, and forbids non-null assertions. Prettier is the formatting source of truth.

## Testing Guidelines

Tests use Jest with `ts-jest` and match `*.spec.ts`. Keep tests close to the behavior being changed. Add or update tests for new tools, contracts, discovery behavior, guards, collectors, and logger changes. Run `pnpm run test` before opening a PR; use package-scoped test commands while iterating.

## Architecture & Security Rules

Preserve the package boundary: the plugin may import NestJS, but must not import the MCP SDK; the server may import the MCP SDK, but must never import `@nestjs/*`. The server must not start an HTTP server.

The plugin should be transparent and production-safe: forward logs to the original logger, avoid changing app behavior, disable by default in production, and keep `/_dev/mcp` localhost-only. Keep user setup near-zero config; prefer auto-discovery and defaults over new required options.

## Commit & Pull Request Guidelines

Recent history uses concise Conventional Commit-style prefixes such as `feat:`, `fix:`, and `chore:`. Keep commits focused. PRs should describe the behavior change, list tests run, note security or config impact, and link related issues when applicable.
