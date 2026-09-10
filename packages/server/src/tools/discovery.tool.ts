import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { discoverServers } from '../discovery.js'
import { DiscoverServersInputSchema } from '../schemas/discovery.schema.js'
import { ResponseFormat, NestServerInfo } from '../types.js'

/**
 * Format uptime seconds into human-readable duration (e.g., "42s", "2m 15s", "1h 10m").
 */
export function formatUptime(uptimeSeconds: number): string {
  if (uptimeSeconds < 60) {
    return `${Math.floor(uptimeSeconds)}s`
  }
  const minutes = Math.floor(uptimeSeconds / 60)
  const seconds = Math.floor(uptimeSeconds % 60)
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return `${hours}h ${remMinutes}m`
}

/**
 * Format discovered NestJS DevTools servers as a human-readable Markdown table.
 */
export function formatServersMarkdown(servers: NestServerInfo[], startPort?: number, endPort?: number): string {
  if (servers.length === 0) {
    const rangeInfo =
      startPort !== undefined && endPort !== undefined ? ` (scanned ports: ${startPort}-${endPort})` : ''
    return [
      '### Discovered NestJS Servers',
      '',
      `No active NestJS DevTools servers found on localhost${rangeInfo}.`,
      '',
      '**Troubleshooting & Next Steps:**',
      '1. Verify your NestJS application is running: `npm run start:dev`',
      '2. Ensure DevtoolsMcpModule is imported or zero-code preload is configured: `npx nestjs-devtools-mcp init`',
      '3. Verify the application port falls within the scan range or specify custom `start_port` and `end_port`.',
    ].join('\n')
  }

  const rows = servers.map(
    (s) => `| ${s.port} | ${s.pid} | ${s.name} | ${s.version} | ${formatUptime(s.uptime)} | ${s.healthUrl} |`,
  )

  return [
    `### Discovered NestJS Servers (${servers.length} active)`,
    '',
    '| Port | PID | App Name | Version | Uptime | Health URL |',
    '|------|-----|----------|---------|--------|------------|',
    ...rows,
  ].join('\n')
}

export function registerDiscoveryTools(server: McpServer, _devtoolsProxy?: DevToolsProxy) {
  server.registerTool(
    'nestjs_discover_servers',
    {
      title: 'Discover NestJS DevTools Servers',
      description: `Scan localhost for running NestJS applications integrated with the NestJS DevTools MCP plugin.

### Args:
- \`start_port\` (optional, number): Starting port for scan range (default: 3000 or NESTJS_MCP_SCAN_START).
- \`end_port\` (optional, number): Ending port for scan range (default: 3010 or NESTJS_MCP_SCAN_END).
- \`response_format\` (optional, 'markdown' | 'json'): Output format. 'markdown' produces a formatted Markdown table; 'json' outputs indented JSON. Default: 'markdown'.

### Returns:
- Text content containing either a human-readable Markdown table or raw JSON.
- \`structuredContent\`: \`{ servers: NestServerInfo[], count: number }\`.

### Examples:
- Use when:
  - Checking which NestJS applications are currently running locally before executing inspection tools.
  - Finding the port of a target NestJS server when multiple apps are running.
  - Troubleshooting connection to NestJS DevTools.
- Don't use when:
  - You already know the target port and want to directly inspect routes, logs, or config (use \`nestjs_get_routes\`, \`nestjs_get_logs\`, etc.).
  - Scanning remote or non-localhost servers.

### Error Handling:
- Returns an actionable error message if \`start_port\` exceeds \`end_port\`, or if system/network inspection fails.`,
      inputSchema: DiscoverServersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ start_port, end_port, response_format }) => {
      try {
        if (start_port !== undefined && end_port !== undefined && start_port > end_port) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Invalid port range. start_port (${start_port}) cannot be greater than end_port (${end_port}). Please provide a valid range (e.g., start_port: 3000, end_port: 3010).`,
              },
            ],
            isError: true,
          }
        }

        const servers = await discoverServers(start_port, end_port)

        const text =
          response_format === ResponseFormat.JSON
            ? JSON.stringify(servers, null, 2)
            : formatServersMarkdown(servers, start_port, end_port)

        return {
          content: [{ type: 'text', text }],
          structuredContent: {
            servers,
            count: servers.length,
          },
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: 'text',
              text: `Failed to scan for NestJS DevTools servers: ${errorMessage}. Check network access and verify localhost port availability.`,
            },
          ],
          isError: true,
        }
      }
    },
  )

  // Legacy compatibility alias 'discover_servers'
  server.registerTool(
    'discover_servers',
    {
      title: 'Discover Servers (Legacy Alias)',
      description:
        '[DEPRECATED: use nestjs_discover_servers] Scan localhost for NestJS servers integrated with the DevTools plugin.',
      inputSchema: DiscoverServersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const servers = await discoverServers(args.start_port, args.end_port)
        return {
          content: [{ type: 'text', text: JSON.stringify(servers, null, 2) }],
          structuredContent: {
            servers,
            count: servers.length,
          },
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: errorMessage }],
          isError: true,
        }
      }
    },
  )
}
