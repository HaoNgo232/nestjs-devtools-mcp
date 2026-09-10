import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { GetLogsInputSchema } from '../schemas/observability.schema.js'
import { ResponseFormat } from '../types.js'
import { paginateEntries, formatLogsMarkdown, createActionableError } from './observability.helper.js'
import { McpLogEntry } from '../contracts/mcp-api.contract.js'

export function registerLogsTools(server: McpServer, devtoolsProxy: DevToolsProxy) {
  server.registerTool(
    'nestjs_get_logs',
    {
      title: 'Get NestJS Logs',
      description: `Retrieve runtime application logs from the NestJS DevTools buffer with level filtering and pagination.

### Args:
- \`port\` (optional, number): NestJS server port. Auto-detected if only 1 server is active.
- \`limit\` (optional, number, 1-200, default: 50): Maximum number of log records to return.
- \`lines\` (optional, number): Alias for \`limit\`.
- \`offset\` (optional, number, min: 0, default: 0): Number of records to skip for pagination.
- \`level\` (optional, 'all' | 'log' | 'error' | 'warn' | 'debug' | 'verbose'): Filter logs by severity level.
- \`request_id\` (optional, string): Filter logs by request correlation ID.
- \`requestId\` (optional, string): Alias for \`request_id\`.
- \`response_format\` (optional, 'markdown' | 'json', default: 'markdown'): Output format.

### Returns:
- Text content containing either a formatted log stream (markdown) or JSON.
- \`structuredContent\`: \`{ total_count: number, has_more: boolean, next_offset: number | null, items: McpLogEntry[] }\`.

### Examples:
- Use when:
  - Debugging errors or exceptions during recent operations (\`level: 'error'\`).
  - Correlating logs for a specific failed HTTP request (\`request_id: 'req-xyz'\`).
  - Reading recent server activity across modules.
- Don't use when:
  - Looking for HTTP request/response metrics (use \`nestjs_get_request_history\`).
  - Diagnosing uncaught crash exceptions (use \`nestjs_get_errors\`).

### Error Handling:
- Returns an actionable error message if the server is unreachable or the DevTools plugin is not loaded.`,
      inputSchema: GetLogsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const targetPort = await devtoolsProxy.resolvePort(args.port)
        const limit = args.lines ?? args.limit ?? 50
        const offset = args.offset ?? 0
        const requestId = args.request_id ?? args.requestId

        const fetchLimit = Math.min(200, offset + limit)
        const rawData = (await devtoolsProxy.callPluginTool(targetPort, 'get_logs', {
          lines: fetchLimit,
          level: args.level,
          requestId,
        })) as Record<string, unknown> | McpLogEntry[]

        const rawEntries: McpLogEntry[] = Array.isArray(rawData)
          ? rawData
          : ((rawData?.entries as McpLogEntry[]) ??
            (rawData?.logs as McpLogEntry[]) ??
            (rawData?.items as McpLogEntry[]) ??
            [])

        const total =
          typeof rawData === 'object' && rawData !== null && 'total' in rawData ? (rawData.total as number) : undefined
        const envelope = paginateEntries(rawEntries, total, offset, limit)

        const text =
          args.response_format === ResponseFormat.JSON
            ? JSON.stringify(envelope, null, 2)
            : formatLogsMarkdown(envelope, offset)

        return {
          content: [{ type: 'text', text }],
          structuredContent: envelope as unknown as Record<string, unknown>,
        }
      } catch (error: unknown) {
        return createActionableError('nestjs_get_logs', error)
      }
    },
  )

  server.registerTool(
    'get_logs',
    {
      title: 'Get Logs (Legacy Alias)',
      description:
        'Retrieve runtime application logs from the NestJS DevTools buffer (Deprecated: use nestjs_get_logs).',
      inputSchema: {
        port: GetLogsInputSchema.port,
        lines: GetLogsInputSchema.lines,
        level: GetLogsInputSchema.level,
        requestId: GetLogsInputSchema.requestId,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ port, ...payload }) => {
      try {
        const targetPort = await devtoolsProxy.resolvePort(port)
        const logData = await devtoolsProxy.callPluginTool(targetPort, 'get_logs', payload)
        return {
          content: [{ type: 'text', text: JSON.stringify(logData, null, 2) }],
          structuredContent: logData as Record<string, unknown>,
        }
      } catch (error: unknown) {
        return {
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        }
      }
    },
  )
}
