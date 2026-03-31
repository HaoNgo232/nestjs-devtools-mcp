# Development Guide

This guide describes the workflow for developing, testing, and publishing the **NestJS DevTools MCP** project.

## Project Structure

The project is a Monorepo using NPM Workspaces:
- `packages/plugin`: The `@nestjs-devtools-mcp/plugin` package (NestJS module).
- `packages/server`: The `nestjs-devtools-mcp` bridge package (MCP Server CLI).
- `demo-app`: A sample NestJS application used for end-to-end testing.

## Development Workflow

### 1. Initial Setup
Clone the repository and install dependencies at the root:
```bash
npm install
```

### 2. Standard Development Loop
Modify files in `src`, then build all workspaces:
```bash
# Build all packages and the demo app
npm run build --workspaces
```

### 3. Testing Changes
Run unit and integration tests with coverage:
```bash
# Run tests for everything
npm run test --workspaces

# Run with coverage report for the plugin
cd packages/plugin && npm test -- --coverage
```

### 4. Code Quality (Linting & Formatting)
We strictly enforce 100% clean lint and Prettier formatting:
```bash
# Run formatter
npm run format

# Run linter
npm run lint
```

### 5. Manual Testing with Demo App
To see your changes in a real NestJS application:
1. Open a terminal and start the demo app:
```bash
cd demo-app && npm start
```
2. In another terminal, perform an HTTP call to the plugin:
```bash
curl http://localhost:3000/_dev/mcp/health
```

---

## Deployment & Publishing

### 1. Versioning
We use semantic versioning. Update the version from the root:
```bash
# Updates version across all packages
npm version patch # or minor/major
```

### 2. Publishing to NPM (Private/Public)
To publish the packages to NPM:

**Package A: Plugin**
```bash
cd packages/plugin
npm run build
npm publish --access public
```

**Package B: Bridge (CLI)**
```bash
cd packages/server
npm run build
npm publish --access public
```

### 3. Local Installation (For testing before publish)
If you want to test the package in another local project without publishing:
```bash
# In your target project
npm install /path/to/nestjs-devtools-mcp/packages/plugin
```

## Architectural Principles

1. **Zero-Config First**: Every feature must work with default settings.
2. **Transparent Log Forwarding**: The plugin must never interfere with the original NestJS console output.
3. **100% Coverage**: All new logic must be fully tested before merging.
4. **Localhost Only**: The plugin controller must explicitly reject any non-localhost requests via the `LocalhostOnlyGuard`.
