# Development Guide

This guide describes the workflow for developing, testing, and publishing the **NestJS DevTools MCP** project.

## Project Structure

The project is a monorepo managed by **pnpm workspaces**:
- `packages/plugin`: The `@nestjs-devtools-mcp/plugin` package (NestJS module).
- `packages/server`: The `nestjs-devtools-mcp` bridge package (MCP Server CLI).
- `demo-app`: A sample NestJS application used for end-to-end testing.

## Development Workflow

### 1. Initial Setup
Clone the repository and install dependencies at the root:
```bash
pnpm install
```

### 2. Standard Development Loop
Modify files in `src`, then build all workspaces:
```bash
# Build all packages
pnpm build
```

### 3. Testing Changes
Run unit and integration tests:
```bash
# Run tests for all packages
pnpm test

# Run with coverage report for the plugin
cd packages/plugin && pnpm test -- --coverage
```

### 4. Code Quality (Linting & Formatting)
We strictly enforce clean lint and Prettier formatting:
```bash
# Run formatter
pnpm run format

# Run linter
pnpm run lint
```

### 5. Pre-push Check (CI Simulation)
Before pushing to GitHub, always run the full CI script at the root:
```bash
# Formats code, lints, builds, and runs all tests
pnpm run ci
```

### 6. Manual Testing with Demo App
To see your changes in a real NestJS application:
1. Open a terminal and start the demo app:
```bash
cd demo-app && pnpm start
```
2. In another terminal, verify the plugin is responding:
```bash
curl http://localhost:3000/_dev/mcp/health
```

---

## Deployment & Publishing

### 1. CI/CD Publishing (Recommended)
Our GitHub Actions workflow automatically builds, tests, and publishes to NPM when you push a version tag. This is the primary release method.

1. Create a version tag:
```bash
git tag v0.1.4
```

2. Push the tag to GitHub:
```bash
git push origin v0.1.4
```

The `release.yml` workflow will pick up the `v*` tag, extract the version string (e.g., `v0.1.4` → `0.1.4`), inject it into both `packages/plugin/package.json` and `packages/server/package.json`, build the monorepo, then publish both packages to NPM.

> **Note:** You do not need to manually update the `version` field in any `package.json`. The release workflow handles this automatically from the git tag.

### 2. Manual Publishing to NPM (Optional)
If you prefer manual publishing, update the version in both package.json files first, then:

**Package A: Plugin**
```bash
cd packages/plugin
pnpm build
npm publish --access public
```

**Package B: Bridge (CLI)**
```bash
cd packages/server
pnpm build
npm publish --access public
```

### 3. Local Installation (For testing before publish)
If you want to test the package in another local project without publishing:
```bash
# In your target project
pnpm add /path/to/nestjs-devtools-mcp/packages/plugin
```

---

## Architectural Principles

1. **Zero-Config First**: Every feature must work with default settings.
2. **Transparent Log Forwarding**: The plugin must never interfere with the original NestJS console output.
3. **Localhost Only**: The plugin controller must explicitly reject any non-localhost requests via the `LocalhostOnlyGuard`.
4. **Full Test Coverage**: All new logic should be fully tested before merging.