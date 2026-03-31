#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { discoverServers } from './discovery.js'
import { DevToolsProxy } from './proxy.js'

import * as pkg from '../package.json'

/**
 * NestJS DevTools MCP - Bridge launched via STDIO transport.
 * AI Client will spawn this process to interact with the NestJS App.
 */
const server = new Server(
  {
    name: 'nestjs-devtools-mcp',
    version: pkg.version,
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

const devtoolsProxy = new DevToolsProxy()

/**
 * Register the list of available tools for the AI Client.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'discover_servers',
        description: 'Scan localhost for NestJS servers integrated with the DevTools plugin.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_logs',
        description: 'Get NestJS server runtime logs (Buffer logs).',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: 'NestJS server port (e.g., 3000). If only 1 server is found, it will be used automatically.',
            },
            lines: {
              type: 'number',
              description:
                'Number of log lines to retrieve (default: 50). Use a reasonable number (e.g. 50-100) to avoid overwhelming the context with unnecessary data.',
            },
            level: {
              type: 'string',
              enum: ['all', 'log', 'error', 'warn', 'debug', 'verbose'],
              description: 'Filter logs by level.',
            },
          },
        },
      },
      {
        name: 'get_routes',
        description:
          'List all registered HTTP routes in the NestJS application with their methods, paths, controllers and handler names.',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: 'NestJS server port. Auto-detected if only one server is running.',
            },
          },
        },
      },
    ],
  }
})

/**
 * Handle Tool Call requests from the AI Client and proxy/execute bridge logic.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'discover_servers': {
        const servers = await discoverServers()
        return {
          content: [{ type: 'text', text: JSON.stringify(servers, null, 2) }],
        }
      }

      case 'get_logs': {
        const schema = z.object({
          port: z.number().optional(),
          lines: z.number().optional(),
          level: z.string().optional(),
        })
        const parsed = schema.parse(args || {})

        const targetPort = await devtoolsProxy.resolvePort(parsed.port)
        const logData = await devtoolsProxy.callPluginTool(targetPort, 'get_logs', {
          lines: parsed.lines,
          level: parsed.level,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify(logData, null, 2) }],
        }
      }

      case 'get_routes': {
        const schema = z.object({
          port: z.number().optional(),
        })
        const parsed = schema.parse(args || {})

        const targetPort = await devtoolsProxy.resolvePort(parsed.port)
        const routeData = await devtoolsProxy.callPluginTool(targetPort, 'get_routes', {})

        return {
          content: [{ type: 'text', text: JSON.stringify(routeData, null, 2) }],
        }
      }

      default:
        throw new Error(`Tool not supported: ${name}`)
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: errorMessage }],
      isError: true,
    }
  }
})

/**
 * Initialize transport and start listening to STDIO.
 */
export async function runServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('NestJS DevTools MCP Bridge has started and is listening on STDIO.')
}

// Chạy server nếu đây là file thực thi chính - Run server if this is the main entry point
// Dùng process.argv[1] thay cho import.meta để tương thích với cấu hình TS hiện tại
const currentFile = process.argv[1]
const isMain = currentFile?.endsWith('index.ts') || currentFile?.endsWith('index.js')

if (isMain) {
  runServer().catch((err) => {
    console.error('Critical error during NestJS DevTools bridge launch:', err)
    process.exit(1)
  })
}

export { server, devtoolsProxy }
