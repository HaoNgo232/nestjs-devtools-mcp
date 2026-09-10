#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { DevToolsProxy } from './proxy.js'
import { registerResources, buildRuntimeGuide } from './resources.js'
import { registerPrompts } from './prompts.js'
import { registerAllTools } from './tools/index.js'
import { runInit, runWithHook } from './cli.js'
import { QUICKSTART_PROMPT_NAME, RUNTIME_GUIDE_URI } from './constants.js'

import * as pkg from '../package.json'

/**
 * NestJS DevTools MCP - Bridge launched via STDIO transport using modern McpServer SDK.
 * AI Client will spawn this process to interact with the NestJS App.
 */
const server = new McpServer({
  name: 'nestjs-devtools-mcp',
  version: pkg.version,
})

const devtoolsProxy = new DevToolsProxy()

// Register Resources, Prompts, and Tools
registerResources(server)
registerPrompts(server)
registerAllTools(server, devtoolsProxy)

/**
 * Initialize transport and start listening to STDIO.
 */
export async function runServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('NestJS DevTools MCP Bridge has started and is listening on STDIO.')
}

// Chạy server nếu đây là file thực thi chính - Run server if this is the main entry point
//
// IMPORTANT: Do NOT simplify this check.
// We need multiple conditions because the execution context varies:
//
// 1. `require.main === module`  → Direct invocation: `node dist/index.js`
// 2. endsWith('index.ts/.js')  → ts-node / local dev environment
// 3. endsWith('nestjs-devtools-mcp') → npx cache: argv[1] is a symlink named
//    after the binary (e.g. ~/.npm/_npx/.../bin/nestjs-devtools-mcp)
//
// Bug history: Using only endsWith('index.js') caused the server to exit
// immediately when run via `npx` because the symlink path didn't match.
// This resulted in IDE MCP clients reporting "Connection closed" (MCP -32000).
const currentFile = process.argv[1]
const isMain =
  (typeof require !== 'undefined' && require.main === module) ||
  currentFile?.endsWith('index.ts') ||
  currentFile?.endsWith('index.js') ||
  currentFile?.endsWith('nestjs-devtools-mcp')

if (isMain) {
  const subcommand = process.argv[2]

  if (subcommand === 'init') {
    const result = runInit()
    console.log(`\x1b[32m[NestJS DevTools MCP]\x1b[0m ${result.message}`)
    if (result.modifiedFiles.length > 0) {
      console.log(`Updated files: ${result.modifiedFiles.join(', ')}`)
    }
    process.exit(0)
  }

  if (subcommand === 'run') {
    runWithHook(process.argv.slice(3))
  } else {
    runServer().catch((err) => {
      console.error('Critical error during NestJS DevTools bridge launch:', err)
      process.exit(1)
    })
  }
}

export { server, devtoolsProxy, runInit, runWithHook, buildRuntimeGuide, QUICKSTART_PROMPT_NAME, RUNTIME_GUIDE_URI }
