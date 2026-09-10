import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { GetRoutesInputSchema, GetRoutesInput } from '../schemas/routes.schema.js'
import { ToolResult, ResponseFormat } from '../types.js'
import { formatActionableError } from './error-formatter.js'

export interface RouteInfo {
  method: string
  path: string
  controllerName: string
  handlerName: string
}

export interface RouteCollectorData {
  routes: RouteInfo[]
  total: number
}

export const GET_ROUTES_DESCRIPTION = `List all registered HTTP routes in the NestJS application with their methods, paths, controllers, and handler names.

Enables agents to discover API structure, verify endpoint availability, and inspect route mappings grouped by controller.

### Args:
- \`port\` (number, optional): NestJS server port. Auto-detected if only one server is running.
- \`method\` (string, optional): Filter by HTTP method (e.g., 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'). Case-insensitive.
- \`path_contains\` (string, optional): Filter routes where URL path contains this substring (e.g., '/api', '/auth'). Case-insensitive.
- \`response_format\` ('markdown' | 'json', optional): Format of returned content. Default is 'markdown'.

### Returns:
- Markdown formatted response grouping endpoints by Controller name with method and path, or machine-readable JSON.
- Programmatic structured content with \`{ routes: RouteInfo[], total: number }\`.

### Examples:
- Discover all routes: \`{}\`
- Find authentication routes: \`{ "path_contains": "/auth" }\`
- List all POST endpoints: \`{ "method": "POST" }\`
- Retrieve JSON on a specific port: \`{ "port": 3000, "response_format": "json" }\`

### Error Handling:
- Returns an actionable error message with troubleshooting advice if the NestJS server is unreachable, multiple servers are detected without port disambiguation, or the plugin is missing.`

/**
 * Formats route information into hierarchical Markdown grouped by Controller.
 */
export function formatRoutesMarkdown(
  routes: RouteInfo[],
  filters?: { method?: string; path_contains?: string },
): string {
  const filterParts: string[] = []
  if (filters?.method) {
    filterParts.push(`method = \`${filters.method.toUpperCase()}\``)
  }
  if (filters?.path_contains) {
    filterParts.push(`path contains \`${filters.path_contains}\``)
  }
  const filterNotice = filterParts.length > 0 ? `*Filters applied: ${filterParts.join(', ')}*` : ''

  if (routes.length === 0) {
    return [
      '## Registered HTTP Routes',
      ...(filterNotice ? [filterNotice] : []),
      '',
      'No routes found matching the specified criteria.',
    ].join('\n')
  }

  // Group by controllerName
  const controllerMap = new Map<string, RouteInfo[]>()
  for (const r of routes) {
    const list = controllerMap.get(r.controllerName) || []
    list.push(r)
    controllerMap.set(r.controllerName, list)
  }

  const lines: string[] = []
  lines.push(`## Registered HTTP Routes (${routes.length} total)`)
  if (filterNotice) {
    lines.push(filterNotice)
  }
  lines.push('')

  for (const [controller, cRoutes] of controllerMap.entries()) {
    lines.push(`### ${controller}`)
    lines.push('| Method | Path | Handler |')
    lines.push('| :--- | :--- | :--- |')
    for (const r of cRoutes) {
      lines.push(`| \`${r.method}\` | \`${r.path}\` | \`${r.handlerName}\` |`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

/**
 * Core handler for nestjs_get_routes.
 */
export async function handleGetRoutes(devtoolsProxy: DevToolsProxy, args: GetRoutesInput): Promise<ToolResult> {
  let targetPort: number | undefined
  try {
    targetPort = await devtoolsProxy.resolvePort(args.port)
    const rawData = (await devtoolsProxy.callPluginTool(targetPort, 'get_routes', {})) as {
      routes?: RouteInfo[]
      total?: number
    }
    const allRoutes: RouteInfo[] = Array.isArray(rawData?.routes) ? rawData.routes : []

    const methodFilter = args.method?.trim().toUpperCase()
    const pathFilter = (args.path_contains ?? args.pathContains)?.trim().toLowerCase()

    const filteredRoutes = allRoutes.filter((route) => {
      if (methodFilter && route.method.toUpperCase() !== methodFilter) {
        return false
      }
      if (pathFilter && !route.path.toLowerCase().includes(pathFilter)) {
        return false
      }
      return true
    })

    const structuredContent = {
      routes: filteredRoutes,
      total: filteredRoutes.length,
    }

    const format = args.response_format ?? ResponseFormat.MARKDOWN
    const text =
      format === ResponseFormat.JSON
        ? JSON.stringify(structuredContent, null, 2)
        : formatRoutesMarkdown(filteredRoutes, {
            method: methodFilter,
            path_contains: args.path_contains ?? args.pathContains,
          })

    return {
      content: [{ type: 'text', text }],
      structuredContent,
    }
  } catch (error: unknown) {
    return {
      content: [{ type: 'text', text: formatActionableError(error, targetPort ?? args.port, 'nestjs_get_routes') }],
      isError: true,
    }
  }
}

export function registerRoutesTools(server: McpServer, devtoolsProxy: DevToolsProxy) {
  // Modernized tool according to Ticket 03
  server.registerTool(
    'nestjs_get_routes',
    {
      title: 'Get NestJS Routes',
      description: GET_ROUTES_DESCRIPTION,
      inputSchema: GetRoutesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => handleGetRoutes(devtoolsProxy, args),
  )

  // Legacy compatibility alias 'get_routes'
  server.registerTool(
    'get_routes',
    {
      title: 'Get Routes (Legacy Alias)',
      description: 'List all registered HTTP routes in the NestJS application (Deprecated: use nestjs_get_routes).',
      inputSchema: {
        port: GetRoutesInputSchema.port,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ port }) => {
      try {
        const targetPort = await devtoolsProxy.resolvePort(port)
        const routeData = await devtoolsProxy.callPluginTool(targetPort, 'get_routes', {})
        return {
          content: [{ type: 'text', text: JSON.stringify(routeData, null, 2) }],
          structuredContent: routeData as Record<string, unknown>,
        }
      } catch (error: unknown) {
        return {
          content: [{ type: 'text', text: formatActionableError(error, port, 'get_routes') }],
          isError: true,
        }
      }
    },
  )
}
