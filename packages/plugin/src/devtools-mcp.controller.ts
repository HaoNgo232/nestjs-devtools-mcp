import { Controller, Get, Post, Body, UseGuards, Param, Inject, NotFoundException } from '@nestjs/common'
import { LocalhostOnlyGuard } from './localhost-only.guard'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options'
import { DEVTOOLS_COLLECTORS, DevtoolsCollector } from './collectors/collector.interface'
import { McpHealthResponse } from './contracts/mcp-api.contract'

/**
 * This Controller exposes the necessary HTTP endpoints for the bridge to collect runtime information.
 * It uses a generic dispatch mechanism to delegate tool execution to registered collectors.
 * The default endpoint path is /_dev/mcp
 */
@Controller('_dev/mcp')
@UseGuards(LocalhostOnlyGuard)
export class DevtoolsMcpController {
  private readonly version = '0.1.3'

  constructor(
    @Inject(DEVTOOLS_OPTIONS_TOKEN)
    private readonly options: DevtoolsMcpOptions,
    @Inject(DEVTOOLS_COLLECTORS)
    private readonly collectors: DevtoolsCollector[],
  ) {}

  /**
   * Endpoint for health checks and bridge auto-discovery.
   * Conforms to the McpHealthResponse contract.
   */
  @Get('health')
  getHealth(): McpHealthResponse {
    const collectorsArray = Array.isArray(this.collectors) ? this.collectors : [this.collectors]
    const tools = collectorsArray.filter((c) => c && c.toolName).map((c) => c.toolName)

    return {
      status: 'ok',
      module: 'nestjs-devtools-mcp', // Required by contract
      name: 'nestjs-devtools-mcp', // Used by bridge discovery
      timestamp: new Date().toISOString(),
      tools,
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
    }
  }

  /**
   * Universal tool execution endpoint.
   * Dispatches the request to the appropriate collector based on the toolName.
   * @param toolName The unique identifier of the tool
   * @param body Request parameters for the tool
   */
  @Post('tools/:toolName')
  async handleTool(@Param('toolName') toolName: string, @Body() body: Record<string, unknown>) {
    const collectorsArray = Array.isArray(this.collectors) ? this.collectors : [this.collectors]
    const collector = collectorsArray.find((c) => c && c.toolName === toolName)

    if (!collector) {
      throw new NotFoundException(`Tool '${toolName}' not found.`)
    }

    const result = await collector.execute(body)
    return result.data
  }
}
