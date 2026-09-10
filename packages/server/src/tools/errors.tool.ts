import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { GetErrorsInputSchema } from '../schemas/observability.schema.js'
import { ResponseFormat } from '../types.js'
import { paginateEntries, formatErrorsMarkdown, createActionableError } from './observability.helper.js'
import { McpErrorEntry } from '../contracts/mcp-api.contract.js'

export function registerErrorsTools(server: McpServer, devtoolsProxy: DevToolsProxy) {
  server.registerTool(
    'nestjs_get_errors',
    {
      title: 'Get Runtime Errors',
      description: `Retrieve recent runtime errors, bootstrap failures, unhandled exceptions, and HTTP 5xx responses from the NestJS application.

### Args:
- \`port\` (optional, number): NestJS server port. Auto-detected if only 1 server is active.
- \`limit\` (optional, number, 1-200, default: 50): Maximum number of error records to return.
- \`offset\` (optional, number, min: 0, default: 0): Number of records to skip for pagination.
- \`source\` (optional, 'bootstrap' | 'runtime' | 'unhandled' | 'http-5xx'): Filter by error origin source.
- \`since\` (optional, number): Unix timestamp in ms. Only return errors occurring after this time.
- \`request_id\` / \`requestId\` (optional, string): Filter by request correlation ID.
- \`only_unhandled\` / \`onlyUnhandled\` (optional, boolean): Return only unhandled exceptions and bootstrap crashes.
- \`include_stack\` / \`includeStack\` (optional, boolean): Include stack traces in output (masked in production).
- \`response_format\` (optional, 'markdown' | 'json', default: 'markdown'): Output format.

### Returns:
- Text content with formatted error origins, timestamps, messages, stack traces (markdown) or JSON.
- \`structuredContent\`: \`{ total_count: number, has_more: boolean, next_offset: number | null, items: McpErrorEntry[] }\`.

### Examples:
- Use when:
  - Diagnosing application startup or bootstrap failures (\`source: 'bootstrap'\`).
  - Inspecting uncaught exceptions or unhandled rejections (\`only_unhandled: true\`).
  - Investigating 5xx internal server errors with stack traces (\`include_stack: true\`).
- Don't use when:
  - Checking general application info/debug logs (use \`nestjs_get_logs\`).
  - Inspecting normal HTTP request flow (use \`nestjs_get_request_history\`).

### Error Handling:
- Returns an actionable error message if the server is unreachable or the DevTools plugin is not loaded.`,
      inputSchema: GetErrorsInputSchema,
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
        const limit = args.limit ?? 50
        const offset = args.offset ?? 0
        const fetchLimit = Math.min(200, offset + limit)

        const payload = {
          limit: fetchLimit,
          source: args.source,
          since: args.since,
          requestId: args.request_id ?? args.requestId,
          onlyUnhandled: args.only_unhandled ?? args.onlyUnhandled,
          includeStack: args.include_stack ?? args.includeStack,
        }

        const rawData = (await devtoolsProxy.callPluginTool(targetPort, 'get_errors', payload)) as
          Record<string, unknown> | McpErrorEntry[]

        const rawEntries: McpErrorEntry[] = Array.isArray(rawData)
          ? rawData
          : ((rawData?.entries as McpErrorEntry[]) ?? (rawData?.items as McpErrorEntry[]) ?? [])

        const total =
          typeof rawData === 'object' && rawData !== null && 'total' in rawData ? (rawData.total as number) : undefined
        const envelope = paginateEntries(rawEntries, total, offset, limit)

        const text =
          args.response_format === ResponseFormat.JSON
            ? JSON.stringify(envelope, null, 2)
            : formatErrorsMarkdown(envelope, offset)

        return {
          content: [{ type: 'text', text }],
          structuredContent: envelope as unknown as Record<string, unknown>,
        }
      } catch (error: unknown) {
        return createActionableError('nestjs_get_errors', error)
      }
    },
  )

  // Legacy compatibility alias 'get_errors'
  server.registerTool(
    'get_errors',
    {
      title: 'Get Errors (Legacy Alias)',
      description:
        'Get recent runtime errors from NestJS app. Sources: bootstrap, runtime, unhandled, http-5xx (Deprecated: use nestjs_get_errors).',
      inputSchema: {
        port: GetErrorsInputSchema.port,
        limit: GetErrorsInputSchema.limit,
        source: GetErrorsInputSchema.source,
        since: GetErrorsInputSchema.since,
        requestId: GetErrorsInputSchema.requestId,
        onlyUnhandled: GetErrorsInputSchema.onlyUnhandled,
        includeStack: GetErrorsInputSchema.includeStack,
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
        const errorData = await devtoolsProxy.callPluginTool(targetPort, 'get_errors', payload)
        return {
          content: [{ type: 'text', text: JSON.stringify(errorData, null, 2) }],
          structuredContent: errorData as Record<string, unknown>,
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
