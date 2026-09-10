/**
 * Formats errors encountered when communicating with the NestJS application or DevTools plugin.
 * Produces actionable troubleshooting guidance for AI agents and human users.
 */
export function formatActionableError(error: unknown, port?: number, toolName?: string): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const isConnectionRefused =
    rawMessage.includes('fetch failed') ||
    rawMessage.includes('ECONNREFUSED') ||
    rawMessage.includes('connect ECONNREFUSED')
  const isNoServerFound = rawMessage.includes('No NestJS server found')
  const isMultipleServers = rawMessage.includes('Multiple NestJS servers found')

  if (isNoServerFound) {
    return (
      `[NestJS DevTools Error] Failed to locate active NestJS server: ${rawMessage}\n\n` +
      `Troubleshooting steps:\n` +
      `1. Ensure your NestJS application is running (e.g. \`npm run start:dev\`).\n` +
      `2. Verify that DevtoolsMcpModule is imported or run the app via \`npx nestjs-devtools-mcp run\`.\n` +
      `3. If running on a non-standard port outside 3000-3010, specify the 'port' parameter explicitly.`
    )
  }

  if (isMultipleServers) {
    return (
      `[NestJS DevTools Error] Multiple NestJS instances detected: ${rawMessage}\n\n` +
      `Action required: Please provide the specific 'port' parameter in your tool request.`
    )
  }

  if (isConnectionRefused) {
    const portStr = port ? ` on port ${port}` : ''
    return (
      `[NestJS DevTools Error] Unable to connect to NestJS DevTools endpoint${portStr}.\n\n` +
      `Troubleshooting steps:\n` +
      `1. Check whether the application process is alive and listening${portStr}.\n` +
      `2. Confirm that DevtoolsMcpModule is loaded in the AppModule.\n` +
      `3. If your application uses a global route prefix, configure NESTJS_MCP_PREFIX environment variable.\n` +
      `Original error: ${rawMessage}`
    )
  }

  return `[NestJS DevTools Error] Execution of ${toolName || 'tool'} failed: ${rawMessage}`
}
