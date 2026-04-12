---
title: 'NestJS DevTools MCP Release Workflow'
description: 'Automated release process: bump version, build, test, publish 2 packages to npm'
tags: ['release', 'publish', 'npm', 'monorepo']
---

# Release Workflow for NestJS DevTools MCP

This prompt automates the release process for the monorepo containing 2 npm packages:

- `@nestjs-devtools-mcp/plugin`
- `nestjs-devtools-mcp`

## Release Type Selection

First, determine the release type:

- **patch** (0.0.X → 0.0.X+1): Bug fixes and doc updates
- **minor** (0.X → 0.X+1.0): New features, no breaking changes
- **major** (X → X+1.0.0): Breaking changes

## Automated Release Steps

### Step 1: Validate Current State

Ask user to confirm:

1. All changes are committed to git
2. No uncommitted files in workspace
3. Specify release type (patch/minor/major)

**User confirmation required here.**

### Step 2: Read Current Versions

- Read `packages/plugin/package.json` version
- Read `packages/server/package.json` version
- Confirm both are synchronized (should be equal)

### Step 3: Calculate New Version

- Parse current version (e.g., 0.1.14)
- Calculate new version based on type:
  - patch: 0.1.15
  - minor: 0.2.0
  - major: 1.0.0

Show calculated new version to user.

**User confirmation required here.**

### Step 4: Bump Versions

Update version in:

1. `packages/plugin/package.json`
2. `packages/server/package.json`
3. Root `package.json` (version field)

### Step 5: Build & Test

Run full verification:

```
pnpm build
pnpm test
```

If any failure:

- Stop and report error
- Ask user to fix issues
- User runs fix command and confirms ready to retry

**User confirmation required if any test fails.**

### Step 6: Display Release Summary

Show to user:

- New version number
- Packages to be published: @nestjs-devtools-mcp/plugin, nestjs-devtools-mcp
- Files changed: package.json files
- Next: npm publish

**User final confirmation before publish.**

### Step 7: Publish to npm

Publish both packages in order:

1. `cd packages/plugin && npm publish --access public`
2. Wait for success
3. `cd packages/server && npm publish --access public`
4. Wait for success

### Step 8: Verify on npm

Confirm published versions are accessible:

```
npm view @nestjs-devtools-mcp/plugin version
npm view nestjs-devtools-mcp version
```

### Step 9: Git Commit & Tag (Optional)

Ask user if they want to:

1. Commit version changes: `git add package.json packages/*/package.json && git commit -m "chore: release v<new_version>"`
2. Tag release: `git tag v<new_version>`
3. Push: `git push origin main && git push origin --tags`

**User choice required here.**

### Step 10: Release Complete

Display summary:

- ✅ Published @nestjs-devtools-mcp/plugin@<version>
- ✅ Published nestjs-devtools-mcp@<version>
- Next steps for users to update (if applicable)
- Link to npm packages

---

## Usage

Run this workflow by asking agent:

```
Help me release NestJS DevTools MCP as [patch|minor|major]
```

Or use custom commands (if implemented):

```
npm run release:patch
npm run release:minor
npm run release:major
npm run release:dry  # Dry run to see what would happen
```

---

## Checkpoints Summary

This workflow has 4 user confirmation points:

| #   | Step           | Decision                              |
| --- | -------------- | ------------------------------------- |
| 1   | Validate state | Confirm ready to release              |
| 2   | New version    | Approve calculated version bump       |
| 3   | Pre-publish    | Final confirmation before npm publish |
| 4   | Git operations | Commit and tag (optional)             |

Between each confirmed step, agent automatically executes commands.
