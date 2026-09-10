import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { RUNTIME_GUIDE_URI } from './constants.js'

export function buildRuntimeGuide() {
  return {
    project: 'nestjs-devtools-mcp',
    purpose: 'Expose NestJS runtime state to AI tools via MCP with zero code changes.',
    setup: {
      zeroCodeSetup: {
        initCommand: 'npx nestjs-devtools-mcp init',
        onDemandRun: 'npx nestjs-devtools-mcp run -- npm run start:dev',
      },
      mcpClient: {
        command: 'npx',
        args: ['-y', 'nestjs-devtools-mcp@latest'],
      },
    },
    availableTools: [
      'nestjs_discover_servers',
      'nestjs_get_logs',
      'nestjs_get_routes',
      'nestjs_get_request_history',
      'nestjs_get_config',
      'nestjs_get_errors',
    ],
    security: {
      localhostOnly: true,
      defaultProductionBehavior: 'plugin disabled when NODE_ENV=production unless explicitly enabled',
    },
  }
}

export function registerResources(server: McpServer) {
  server.registerResource(
    'nestjs_devtools_runtime_guide',
    RUNTIME_GUIDE_URI,
    {
      title: 'NestJS DevTools Runtime Guide',
      description: 'Machine-readable runtime usage and setup guide for agents.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(buildRuntimeGuide(), null, 2),
        },
      ],
    }),
  )
}
