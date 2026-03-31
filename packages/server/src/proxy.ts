import { discoverServers } from './discovery.js'

/**
 * Class for handling proxy requests from the MCP server to the plugin running in the NestJS app.
 */
export class DevToolsProxy {
  private lastSelectedPort: number | null = null

  /**
   * Automatically determine the NestJS server port to perform a tool call.
   * Prioritize the single server found or the port explicitly provided.
   */
  async resolvePort(explicitPort?: number): Promise<number> {
    if (explicitPort) {
      this.lastSelectedPort = explicitPort
      return explicitPort
    }

    const instances = await discoverServers()
    if (instances.length === 1) {
      this.lastSelectedPort = instances[0].port
      return instances[0].port
    }

    if (instances.length > 1) {
      throw new Error(
        `Multiple NestJS servers found on ports (${instances.map((i) => i.port).join(', ')}). Please provide the specific port desired.`,
      )
    }

    throw new Error(
      'No NestJS server found running the DevTools MCP plugin (ports 3000-3010). Please ensure the plugin is installed and imported.',
    )
  }

  /**
   * Make an HTTP request to a specific plugin endpoint.
   */
  async callPluginTool(port: number, toolName: string, payload: unknown = {}): Promise<unknown> {
    const url = `http://localhost:${port}/_dev/mcp/tools/${toolName}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Plugin error (HTTP ${response.status}): ${errorText}`)
    }

    return await response.json()
  }
}
