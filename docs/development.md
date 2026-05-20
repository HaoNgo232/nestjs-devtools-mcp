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

Since CI/CD workflows have been removed, publishing to NPM is done manually.

### 1. Syncing Version
Before publishing, make sure to update the version across all `package.json` files in the monorepo. You can do this by running a quick node script or manually updating the `version` field in the following files:
- `./package.json` (root)
- `./packages/plugin/package.json`
- `./packages/server/package.json`
- `./demo-app/package.json`

Example sync command (run from the root of the repository):
```bash
node -e "
  const fs = require('fs');
  const version = '0.2.0'; // Replace with your target version
  const files = [
    './package.json',
    './packages/plugin/package.json',
    './packages/server/package.json',
    './demo-app/package.json'
  ];
  files.forEach(f => {
    if (!fs.existsSync(f)) return;
    const pkg = JSON.parse(fs.readFileSync(f, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(f, JSON.stringify(pkg, null, 2) + '\n');
    console.log('Updated', f, 'to v' + version);
  });
"
```

### 2. Publishing to NPM
After syncing versions, build and publish both packages.

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