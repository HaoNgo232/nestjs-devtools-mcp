import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { QUICKSTART_PROMPT_NAME } from './constants.js'

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    QUICKSTART_PROMPT_NAME,
    {
      title: 'Install NestJS DevTools MCP',
      description: 'Step-by-step quickstart to connect a running NestJS app with this MCP bridge.',
    },
    async () => ({
      description: 'Quickstart guide for installing and connecting NestJS DevTools MCP.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              '1. Configure MCP client:',
              '{"command":"npx","args":["-y","nestjs-devtools-mcp@latest"]}',
              '',
              '2. In your NestJS project directory, run zero-code setup (no code changes needed):',
              'npx nestjs-devtools-mcp init',
              '',
              '3. Start your NestJS app normally:',
              'npm run start:dev',
              '',
              'Then call tools nestjs_discover_servers, nestjs_get_logs, nestjs_get_routes, nestjs_get_request_history, nestjs_get_config, and nestjs_get_errors.',
            ].join('\n'),
          },
        },
      ],
    }),
  )
}
