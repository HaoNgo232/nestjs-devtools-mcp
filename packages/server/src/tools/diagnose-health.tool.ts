import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { DiagnoseHealthInputSchema, DiagnoseHealthInput } from '../schemas/diagnose-health.schema.js'
import { formatActionableError } from './error-formatter.js'
import { formatUptime } from './discovery.tool.js'
import { ToolResult, ResponseFormat } from '../types.js'

export interface DiagnosticHealthPayload {
  server: {
    name: string
    uptime: number
    pid: number
    nodeVersion: string
  }
  routes: {
    total: number
  }
  traffic: {
    sampleSize: number
    distribution: {
      '2xx': number
      '3xx': number
      '4xx': number
      '5xx': number
    }
    errorRate: string
    slowestRequest?: {
      method: string
      path: string
      durationMs: number
      statusCode: number
    } | null
  }
  errors: {
    totalInBuffer: number
    unhandledCount: number
    recent: Array<{
      id: string
      timestamp: number
      source: string
      name: string
      message: string
      stack: string | null
      context: string | null
      requestId: string | null
      correlatedLogs: Array<{
        timestamp: number
        level: string
        message: string
        context?: string
      }>
    }>
  }
}

export function formatDiagnoseHealthMarkdown(data: DiagnosticHealthPayload): string {
  const { server, routes, traffic, errors } = data

  const lines: string[] = [
    `# 🩺 NestJS Health & Diagnostics Report: \`${server.name}\``,
    '',
    `**Uptime:** ${formatUptime(server.uptime)} | **PID:** \`${server.pid}\` | **Node:** \`${server.nodeVersion}\` | **Total Endpoints:** **${routes.total}**`,
    '',
    '## 📊 Traffic & Reliability Summary',
    `- **Sampled Requests:** ${traffic.sampleSize}`,
    `- **Error Rate:** **${traffic.errorRate}** (4xx: ${traffic.distribution['4xx']}, 5xx: ${traffic.distribution['5xx']})`,
    `- **Status Breakdown:** \`🟢 2xx: ${traffic.distribution['2xx']}\` | \`🔵 3xx: ${traffic.distribution['3xx']}\` | \`🟡 4xx: ${traffic.distribution['4xx']}\` | \`🔴 5xx: ${traffic.distribution['5xx']}\``,
  ]

  if (traffic.slowestRequest) {
    lines.push(
      `- **Slowest Request:** \`${traffic.slowestRequest.method} ${traffic.slowestRequest.path}\` (${traffic.slowestRequest.durationMs}ms - Status ${traffic.slowestRequest.statusCode})`,
    )
  }

  lines.push('')
  lines.push('## ⚠️ Recent Errors & Correlated Logs')

  if (errors.recent.length === 0) {
    lines.push('🟢 **No errors recorded in the buffer.** Application is running clean.')
  } else {
    lines.push(
      `Found **${errors.totalInBuffer}** error(s) in buffer (**${errors.unhandledCount}** unhandled). Showing latest ${errors.recent.length}:`,
    )
    lines.push('')

    for (let i = 0; i < errors.recent.length; i++) {
      const err = errors.recent[i]
      const timeStr = new Date(err.timestamp).toISOString()
      const reqId = err.requestId ? `\`${err.requestId}\`` : '*(none)*'

      lines.push(`### ${i + 1}. [${err.source.toUpperCase()}] ${err.name}: ${err.message}`)
      lines.push(
        `- **Time:** \`${timeStr}\` | **Context:** \`${err.context || 'Global'}\` | **Correlation ID:** ${reqId}`,
      )

      if (err.stack) {
        lines.push('```text')
        lines.push(err.stack.split('\n').slice(0, 5).join('\n'))
        lines.push('```')
      }

      if (err.correlatedLogs && err.correlatedLogs.length > 0) {
        lines.push('**Correlated Request Logs:**')
        for (const log of err.correlatedLogs) {
          lines.push(`- \`[${log.level.toUpperCase()}]\` ${log.message}`)
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

export async function handleDiagnoseHealth(
  devtoolsProxy: DevToolsProxy,
  args: DiagnoseHealthInput,
): Promise<ToolResult> {
  let targetPort: number | undefined
  try {
    targetPort = await devtoolsProxy.resolvePort(args.port)
    const rawData = (await devtoolsProxy.callPluginTool(targetPort, 'diagnose_health', {
      recentErrorsLimit: args.recent_errors_limit,
    })) as DiagnosticHealthPayload

    const format = args.response_format ?? ResponseFormat.MARKDOWN
    const text =
      format === ResponseFormat.JSON ? JSON.stringify(rawData, null, 2) : formatDiagnoseHealthMarkdown(rawData)

    return {
      content: [{ type: 'text', text }],
      structuredContent: rawData as unknown as Record<string, unknown>,
    }
  } catch (error: unknown) {
    return {
      content: [{ type: 'text', text: formatActionableError(error, targetPort, 'nestjs_diagnose_health') }],
      isError: true,
    }
  }
}

export function registerDiagnoseHealthTool(server: McpServer, devtoolsProxy: DevToolsProxy) {
  server.registerTool(
    'nestjs_diagnose_health',
    {
      title: 'Diagnose NestJS Health & Status (One-Shot)',
      description: `Retrieve a single, comprehensive diagnostic snapshot of the running NestJS application. Combines uptime, registered route counts, traffic reliability distribution (2xx/4xx/5xx), and recent crashes paired directly with correlated request logs.

### Args:
- \`port\` (optional, number): NestJS server port. Auto-detected if only 1 server is active.
- \`recent_errors_limit\` (optional, number): Number of recent crash/5xx errors to inspect (1-10, default: 3).
- \`response_format\` (optional, 'markdown' | 'json'): Output format. Default: 'markdown'.

### Returns:
- Rich Markdown overview or machine-readable JSON.
- \`structuredContent\`: \`{ server, routes, traffic, errors }\`.

### Examples:
- Use when:
  - First inspecting an app or debugging an issue, to get a complete picture in 1 round-trip.
  - Verifying if any 5xx errors or unhandled exceptions occurred without manually checking separate logs.
- Don't use when:
  - You only want to paginate through hundreds of historical logs (use \`nestjs_get_logs\`).

### Error Handling:
- Returns actionable troubleshooting guidance if the target NestJS server is unreachable.`,
      inputSchema: DiagnoseHealthInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => handleDiagnoseHealth(devtoolsProxy, args),
  )
}
