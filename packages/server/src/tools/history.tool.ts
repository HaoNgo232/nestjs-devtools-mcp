import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { GetRequestHistoryInputSchema } from '../schemas/observability.schema.js'
import { ResponseFormat } from '../types.js'
import { paginateEntries, formatRequestHistoryMarkdown, createActionableError } from './observability.helper.js'
import { RequestHistoryEntry } from '../contracts/mcp-api.contract.js'

export function registerHistoryTools(server: McpServer, devtoolsProxy: DevToolsProxy) {
  server.registerTool(
    'nestjs_get_request_history',
    {
      title: 'Get Request History',
      description: `Retrieve recent HTTP request/response metrics and history from the NestJS application with status codes, latency, and error details.

### Args:
- \`port\` (optional, number): NestJS server port. Auto-detected if only 1 server is active.
- \`limit\` (optional, number, 1-200, default: 50): Maximum number of requests to return.
- \`offset\` (optional, number, min: 0, default: 0): Number of records to skip for pagination.
- \`method\` (optional, string): Filter by HTTP method (e.g., GET, POST, PUT, DELETE).
- \`status_code\` / \`statusCode\` (optional, number): Filter by exact HTTP status code (e.g. 200, 404, 500).
- \`status_class\` / \`statusClass\` (optional, '2xx' | '3xx' | '4xx' | '5xx'): Filter by HTTP status class.
- \`path_contains\` / \`pathContains\` (optional, string): Filter to requests whose URL path contains this substring.
- \`min_duration_ms\` / \`minDurationMs\` (optional, number): Filter to requests that took at least this many milliseconds.
- \`only_errors\` / \`onlyErrors\` (optional, boolean): Return only failed requests (status >= 400 or with errors).
- \`request_id\` / \`requestId\` (optional, string): Filter by request correlation ID.
- \`response_format\` (optional, 'markdown' | 'json', default: 'markdown'): Output format.

### Returns:
- Text content containing a formatted Markdown table with status code badges or JSON.
- \`structuredContent\`: \`{ total_count: number, has_more: boolean, next_offset: number | null, items: RequestHistoryEntry[] }\`.

### Examples:
- Use when:
  - Finding slow endpoints or performance bottlenecks (\`min_duration_ms: 200\`).
  - Investigating 4xx/5xx API failures (\`only_errors: true\` or \`status_class: '5xx'\`).
  - Verifying if an endpoint received traffic and checking response duration.
- Don't use when:
  - Inspecting application console logs (use \`nestjs_get_logs\`).
  - Listing declared API route patterns (use \`nestjs_get_routes\`).

### Error Handling:
- Returns an actionable error message if the server is unreachable or the DevTools plugin is not loaded.`,
      inputSchema: GetRequestHistoryInputSchema,
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
          method: args.method,
          statusCode: args.status_code ?? args.statusCode,
          statusClass: args.status_class ?? args.statusClass,
          pathContains: args.path_contains ?? args.pathContains,
          minDurationMs: args.min_duration_ms ?? args.minDurationMs,
          onlyErrors: args.only_errors ?? args.onlyErrors,
          requestId: args.request_id ?? args.requestId,
        }

        const rawData = (await devtoolsProxy.callPluginTool(targetPort, 'get_request_history', payload)) as
          Record<string, unknown> | RequestHistoryEntry[]

        const rawEntries: RequestHistoryEntry[] = Array.isArray(rawData)
          ? rawData
          : ((rawData?.entries as RequestHistoryEntry[]) ?? (rawData?.items as RequestHistoryEntry[]) ?? [])

        const total =
          typeof rawData === 'object' && rawData !== null && 'total' in rawData ? (rawData.total as number) : undefined
        const envelope = paginateEntries(rawEntries, total, offset, limit)

        const text =
          args.response_format === ResponseFormat.JSON
            ? JSON.stringify(envelope, null, 2)
            : formatRequestHistoryMarkdown(envelope, offset)

        return {
          content: [{ type: 'text', text }],
          structuredContent: envelope as unknown as Record<string, unknown>,
        }
      } catch (error: unknown) {
        return createActionableError('nestjs_get_request_history', error)
      }
    },
  )

  // Legacy compatibility alias 'get_request_history'
  server.registerTool(
    'get_request_history',
    {
      title: 'Get Request History (Legacy Alias)',
      description:
        'Get recent HTTP requests processed by the NestJS server. Useful for debugging API errors, slow endpoints, and verifying traffic (Deprecated: use nestjs_get_request_history).',
      inputSchema: {
        port: GetRequestHistoryInputSchema.port,
        limit: GetRequestHistoryInputSchema.limit,
        method: GetRequestHistoryInputSchema.method,
        statusCode: GetRequestHistoryInputSchema.statusCode,
        statusClass: GetRequestHistoryInputSchema.statusClass,
        pathContains: GetRequestHistoryInputSchema.pathContains,
        minDurationMs: GetRequestHistoryInputSchema.minDurationMs,
        onlyErrors: GetRequestHistoryInputSchema.onlyErrors,
        requestId: GetRequestHistoryInputSchema.requestId,
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
        const requestHistoryData = await devtoolsProxy.callPluginTool(targetPort, 'get_request_history', payload)
        return {
          content: [{ type: 'text', text: JSON.stringify(requestHistoryData, null, 2) }],
          structuredContent: requestHistoryData as Record<string, unknown>,
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
