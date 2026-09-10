import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { DevToolsProxy } from '../proxy.js'
import { GetConfigInputSchema, GetConfigInput, ConfigSourceType } from '../schemas/config.schema.js'
import { ToolResult, ResponseFormat } from '../types.js'
import { formatActionableError } from './error-formatter.js'

export interface ConfigEntry {
  source: 'env' | 'config-service'
  key: string
  status: 'set' | 'empty' | 'masked'
  masked: boolean
  value: string | number | boolean | null
  type: string
}

export interface ConfigCollectorData {
  [key: string]: unknown
  entries: ConfigEntry[]
  total: number
  configServiceAvailable: boolean
  nodeEnv: string
  warnings: string[]
}

export const GET_CONFIG_DESCRIPTION = `Inspect runtime configuration in the active NestJS application (environment variables and ConfigService).

Sensitive credentials and secrets (passwords, tokens, API keys, private keys, database URLs) are automatically sanitized/masked for safety.

### Args:
- \`port\` (number, optional): NestJS server port. Auto-detected if only one server is running.
- \`source\` ('all' | 'env' | 'config-service', optional): Configuration source to inspect. Default is 'all'.
- \`key_contains\` (string, optional): Filter configuration keys containing this substring (case-insensitive).
- \`include_masked\` (boolean, optional): Whether to include keys whose values are masked because they contain sensitive data (default: true).
- \`response_format\` ('markdown' | 'json', optional): Format of returned content. Default is 'markdown'.

### Returns:
- Markdown formatted table displaying Key, Source, Type, Status, and Value (with 🔒 \`[MASKED]\` badges for secrets), or JSON object.
- Structured content containing \`{ entries: ConfigEntry[], total: number, configServiceAvailable: boolean, nodeEnv: string, warnings: string[] }\`.

### Examples:
- Inspect all runtime configuration: \`{}\`
- Inspect environment variables only: \`{ "source": "env" }\`
- Find database-related configuration: \`{ "key_contains": "DB" }\`
- Exclude masked secrets from response: \`{ "include_masked": false }\`
- Return JSON for automated parsing: \`{ "response_format": "json" }\`

### Error Handling:
- Returns an actionable error message with troubleshooting guidance if the NestJS server is unreachable, multiple servers are active without port disambiguation, or the plugin is not installed.`

/**
 * Formats runtime configuration entries into Markdown with masked secret badges.
 */
export function formatConfigMarkdown(
  data: ConfigCollectorData,
  filters?: { source?: ConfigSourceType; key_contains?: string; include_masked?: boolean },
): string {
  const lines: string[] = []
  const { entries, configServiceAvailable, nodeEnv, warnings } = data

  const filterParts: string[] = []
  if (filters?.source && filters.source !== 'all') {
    filterParts.push(`source = \`${filters.source}\``)
  }
  if (filters?.key_contains) {
    filterParts.push(`key contains \`${filters.key_contains}\``)
  }
  if (filters?.include_masked === false) {
    filterParts.push(`include_masked = \`false\``)
  }
  const filterNotice = filterParts.length > 0 ? `*Filters applied: ${filterParts.join(', ')}*` : ''

  lines.push(`## NestJS Configuration (${entries.length} entries)`)
  lines.push(`- **Environment:** \`${nodeEnv || 'not set'}\``)
  lines.push(`- **ConfigService Active:** ${configServiceAvailable ? 'Yes' : 'No'}`)
  if (filterNotice) {
    lines.push(filterNotice)
  }
  lines.push('')

  if (warnings && warnings.length > 0) {
    lines.push('> ⚠️ **Warnings:**')
    for (const w of warnings) {
      lines.push(`> - ${w}`)
    }
    lines.push('')
  }

  if (entries.length === 0) {
    lines.push('No configuration entries found matching the specified criteria.')
    return lines.join('\n').trim()
  }

  lines.push('| Key | Source | Type | Status | Value |')
  lines.push('| :--- | :--- | :--- | :--- | :--- |')

  for (const entry of entries) {
    let displayVal: string
    if (entry.masked) {
      displayVal = '🔒 `[MASKED]`'
    } else if (entry.value === null || entry.value === undefined || entry.status === 'empty') {
      displayVal = '*(empty)*'
    } else {
      displayVal = `\`${String(entry.value).replace(/`/g, '\\`')}\``
    }
    const statusBadge = entry.masked ? '`masked`' : `\`${entry.status}\``
    lines.push(`| \`${entry.key}\` | \`${entry.source}\` | \`${entry.type}\` | ${statusBadge} | ${displayVal} |`)
  }

  return lines.join('\n').trim()
}

/**
 * Core handler for nestjs_get_config.
 */
export async function handleGetConfig(devtoolsProxy: DevToolsProxy, args: GetConfigInput): Promise<ToolResult> {
  let targetPort: number | undefined
  try {
    targetPort = await devtoolsProxy.resolvePort(args.port)
    const source = args.source ?? 'all'
    const keyContains = args.key_contains ?? args.keyContains
    const includeMasked = args.include_masked ?? args.includeMasked ?? true

    const payload = {
      source,
      keyContains,
      includeMasked,
      key_contains: keyContains,
      include_masked: includeMasked,
    }

    const raw = (await devtoolsProxy.callPluginTool(targetPort, 'get_config', payload)) as ConfigCollectorData
    const entries: ConfigEntry[] = Array.isArray(raw?.entries) ? raw.entries : []

    const structuredContent: ConfigCollectorData = {
      entries,
      total: typeof raw?.total === 'number' ? raw.total : entries.length,
      configServiceAvailable: Boolean(raw?.configServiceAvailable),
      nodeEnv: raw?.nodeEnv ?? '',
      warnings: Array.isArray(raw?.warnings) ? raw.warnings : [],
    }

    const format = args.response_format ?? ResponseFormat.MARKDOWN
    const text =
      format === ResponseFormat.JSON
        ? JSON.stringify(structuredContent, null, 2)
        : formatConfigMarkdown(structuredContent, {
            source,
            key_contains: keyContains,
            include_masked: includeMasked,
          })

    return {
      content: [{ type: 'text', text }],
      structuredContent,
    }
  } catch (error: unknown) {
    return {
      content: [{ type: 'text', text: formatActionableError(error, targetPort ?? args.port, 'nestjs_get_config') }],
      isError: true,
    }
  }
}

export function registerConfigTools(server: McpServer, devtoolsProxy: DevToolsProxy) {
  // Modernized tool according to Ticket 03
  server.registerTool(
    'nestjs_get_config',
    {
      title: 'Get NestJS Configuration',
      description: GET_CONFIG_DESCRIPTION,
      inputSchema: GetConfigInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => handleGetConfig(devtoolsProxy, args),
  )

  // Legacy compatibility alias 'get_config'
  server.registerTool(
    'get_config',
    {
      title: 'Get Config (Legacy Alias)',
      description: 'Inspect runtime configuration (Deprecated: use nestjs_get_config).',
      inputSchema: {
        port: GetConfigInputSchema.port,
        source: z.enum(['all', 'env', 'config-service']).optional(),
        keyContains: z.string().optional(),
        includeMasked: z.boolean().optional(),
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
        const configData = (await devtoolsProxy.callPluginTool(targetPort, 'get_config', payload)) as Record<
          string,
          unknown
        >
        return {
          content: [{ type: 'text', text: JSON.stringify(configData, null, 2) }],
          structuredContent: configData,
        }
      } catch (error: unknown) {
        return {
          content: [{ type: 'text', text: formatActionableError(error, port, 'get_config') }],
          isError: true,
        }
      }
    },
  )
}
