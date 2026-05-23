#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
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
      prompts: {},
      resources: {},
    },
  },
)

const devtoolsProxy = new DevToolsProxy()

const QUICKSTART_PROMPT_NAME = 'install_nestjs_devtools_mcp'
const RUNTIME_GUIDE_URI = 'nestjs-devtools://runtime-guide'

function buildRuntimeGuide() {
  return {
    project: 'nestjs-devtools-mcp',
    purpose: 'Expose NestJS runtime state to AI tools via MCP with near-zero config.',
    setup: {
      plugin: {
        package: '@nestjs-devtools-mcp/plugin',
        moduleImport: 'DevtoolsMcpModule.register()',
        loggerHook: 'applyDevtoolsLogger(app)',
      },
      mcpClient: {
        command: 'npx',
        args: ['-y', 'nestjs-devtools-mcp@latest'],
      },
    },
    availableTools: ['discover_servers', 'get_logs', 'get_routes', 'get_request_history', 'get_config'],
    security: {
      localhostOnly: true,
      defaultProductionBehavior: 'plugin disabled when NODE_ENV=production unless explicitly enabled',
    },
  }
}

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
            requestId: {
              type: 'string',
              description: 'Filter logs by request correlation ID (can be null or string).',
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
      {
        name: 'get_request_history',
        description:
          'Get recent HTTP requests processed by the NestJS server. Useful for debugging API errors, slow endpoints, and verifying traffic.',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: 'NestJS server port. Auto-detected if only one server is running.',
            },
            limit: {
              type: 'number',
              description: 'Number of entries (default 50, max 200)',
            },
            method: {
              type: 'string',
              description: 'Filter by HTTP method, such as GET, POST, PUT, PATCH, or DELETE.',
            },
            statusCode: {
              type: 'number',
              description: 'Filter by exact HTTP status code.',
            },
            statusClass: {
              type: 'string',
              enum: ['2xx', '3xx', '4xx', '5xx'],
              description: 'Filter by HTTP status class.',
            },
            pathContains: {
              type: 'string',
              description: 'Filter to requests whose path contains this substring.',
            },
            minDurationMs: {
              type: 'number',
              description: 'Filter to requests that took at least this many milliseconds.',
            },
            onlyErrors: {
              type: 'boolean',
              description: 'Return only failed/error requests.',
            },
            requestId: {
              type: 'string',
              description: 'Filter by request correlation ID (can be null or string).',
            },
          },
        },
      },
      {
        name: 'get_config',
        description:
          'Inspect runtime configuration (env vars + ConfigService). Secrets are automatically masked. Use to debug "why is this env behaving differently".',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: 'NestJS server port. Auto-detected if only one server is running.',
            },
            source: {
              type: 'string',
              enum: ['all', 'env', 'config-service'],
              description: 'Configuration source to inspect.',
            },
            keyContains: {
              type: 'string',
              description: 'Filter to configuration keys containing this substring.',
            },
            includeMasked: {
              type: 'boolean',
              description: 'Include keys whose values are masked because they look sensitive.',
            },
          },
        },
      },
    ],
  }
})

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: QUICKSTART_PROMPT_NAME,
        title: 'Install NestJS DevTools MCP',
        description: 'Step-by-step quickstart to connect a running NestJS app with this MCP bridge.',
      },
    ],
  }
})

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const promptName = request.params.name

  if (promptName !== QUICKSTART_PROMPT_NAME) {
    throw new Error(`Prompt not supported: ${promptName}`)
  }

  return {
    description: 'Quickstart guide for installing and connecting NestJS DevTools MCP.',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            'Install plugin in your NestJS project:',
            'npm install @nestjs-devtools-mcp/plugin',
            '',
            'Register in app.module.ts:',
            "import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin'",
            'imports: [DevtoolsMcpModule.register()]',
            '',
            'Apply logger in main.ts:',
            "import { applyDevtoolsLogger } from '@nestjs-devtools-mcp/plugin'",
            'const app = await NestFactory.create(AppModule, { bufferLogs: true })',
            'applyDevtoolsLogger(app)',
            '',
            'Configure MCP client:',
            '{"command":"npx","args":["-y","nestjs-devtools-mcp@latest"]}',
            '',
            'Then call tools discover_servers, get_logs, get_routes, get_request_history, and get_config.',
          ].join('\n'),
        },
      },
    ],
  }
})

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: RUNTIME_GUIDE_URI,
        name: 'nestjs_devtools_runtime_guide',
        title: 'NestJS DevTools Runtime Guide',
        description: 'Machine-readable runtime usage and setup guide for agents.',
        mimeType: 'application/json',
      },
    ],
  }
})

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params

  if (uri !== RUNTIME_GUIDE_URI) {
    throw new Error(`Resource not found: ${uri}`)
  }

  return {
    contents: [
      {
        uri: RUNTIME_GUIDE_URI,
        mimeType: 'application/json',
        text: JSON.stringify(buildRuntimeGuide(), null, 2),
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
          requestId: z.string().nullable().optional(),
        })
        const parsed = schema.parse(args || {})

        const targetPort = await devtoolsProxy.resolvePort(parsed.port)
        const logData = await devtoolsProxy.callPluginTool(targetPort, 'get_logs', {
          lines: parsed.lines,
          level: parsed.level,
          requestId: parsed.requestId,
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

      case 'get_request_history': {
        const schema = z.object({
          port: z.number().optional(),
          limit: z.number().optional(),
          method: z.string().optional(),
          statusCode: z.number().optional(),
          statusClass: z.enum(['2xx', '3xx', '4xx', '5xx']).optional(),
          pathContains: z.string().optional(),
          minDurationMs: z.number().optional(),
          onlyErrors: z.boolean().optional(),
          requestId: z.string().nullable().optional(),
        })
        const { port, ...payload } = schema.parse(args || {})

        const targetPort = await devtoolsProxy.resolvePort(port)
        const requestHistoryData = await devtoolsProxy.callPluginTool(targetPort, 'get_request_history', payload)

        return {
          content: [{ type: 'text', text: JSON.stringify(requestHistoryData, null, 2) }],
        }
      }

      case 'get_config': {
        const schema = z.object({
          port: z.number().optional(),
          source: z.enum(['all', 'env', 'config-service']).optional(),
          keyContains: z.string().optional(),
          includeMasked: z.boolean().optional(),
        })
        const { port, ...payload } = schema.parse(args || {})

        const targetPort = await devtoolsProxy.resolvePort(port)
        const configData = await devtoolsProxy.callPluginTool(targetPort, 'get_config', payload)

        return {
          content: [{ type: 'text', text: JSON.stringify(configData, null, 2) }],
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
  runServer().catch((err) => {
    console.error('Critical error during NestJS DevTools bridge launch:', err)
    process.exit(1)
  })
}

export { server, devtoolsProxy }
