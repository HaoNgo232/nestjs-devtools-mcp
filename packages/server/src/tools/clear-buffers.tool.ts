import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { ClearBuffersInputSchema, ClearBuffersInput } from '../schemas/clear-buffers.schema.js'
import { formatActionableError } from './error-formatter.js'
import { ToolResult } from '../types.js'

export interface ClearBuffersResponsePayload {
  target: string
  cleared: {
    logs: number
    history: number
    errors: number
  }
  totalCleared: number
}

export function formatClearBuffersMarkdown(payload: ClearBuffersResponsePayload): string {
  const { target, cleared, totalCleared } = payload
  return [
    '### 🧹 NestJS Buffers Purged Successfully',
    '',
    `**Target:** \`${target}\` | **Total Records Removed:** **${totalCleared}**`,
    '',
    '| Buffer | Records Cleared | Status |',
    '|---|---|---|',
    `| Runtime Logs | ${cleared.logs} | ${cleared.logs > 0 ? '🟢 Emptied' : '⚪ Unchanged'} |`,
    `| Request History | ${cleared.history} | ${cleared.history > 0 ? '🟢 Emptied' : '⚪ Unchanged'} |`,
    `| Error Stacks | ${cleared.errors} | ${cleared.errors > 0 ? '🟢 Emptied' : '⚪ Unchanged'} |`,
    '',
    '> **Tip:** You can now trigger fresh HTTP requests to verify fixes without residual telemetry noise.',
  ].join('\n')
}

export async function handleClearBuffers(devtoolsProxy: DevToolsProxy, args: ClearBuffersInput): Promise<ToolResult> {
  let targetPort: number | undefined
  try {
    targetPort = await devtoolsProxy.resolvePort(args.port)
    const rawData = (await devtoolsProxy.callPluginTool(targetPort, 'clear_buffers', {
      target: args.target,
    })) as ClearBuffersResponsePayload

    return {
      content: [{ type: 'text', text: formatClearBuffersMarkdown(rawData) }],
      structuredContent: rawData as unknown as Record<string, unknown>,
    }
  } catch (error: unknown) {
    return {
      content: [{ type: 'text', text: formatActionableError(error, targetPort, 'nestjs_clear_buffers') }],
      isError: true,
    }
  }
}

export function registerClearBuffersTool(server: McpServer, devtoolsProxy: DevToolsProxy) {
  server.registerTool(
    'nestjs_clear_buffers',
    {
      title: 'Clear NestJS In-Memory Buffers',
      description: `Purge in-memory telemetry buffers (logs, HTTP request traffic, and error stacks) from the running NestJS application.

### Args:
- \`port\` (optional, number): NestJS server port. Auto-detected if only 1 server is active.
- \`target\` (optional, 'all' | 'logs' | 'history' | 'errors'): Which buffer to purge. Default: 'all'.

### Returns:
- Markdown summary reporting the number of cleared entries per buffer.
- \`structuredContent\`: \`{ target: string, cleared: { logs, history, errors }, totalCleared: number }\`.

### Examples:
- Use when:
  - You have just modified code to fix a bug and want to clear out stale logs/errors before re-testing.
  - Resetting traffic history before running a new benchmark or integration check.
- Don't use when:
  - You need to preserve historical error data for debugging.

### Error Handling:
- Returns actionable instructions if the targeted NestJS server is offline or unreachable.`,
      inputSchema: ClearBuffersInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => handleClearBuffers(devtoolsProxy, args),
  )
}
