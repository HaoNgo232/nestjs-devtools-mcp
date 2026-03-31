import { Controller, Get, Post, Body, UseGuards, Query, Inject } from '@nestjs/common';
import { LogBufferService } from './log-buffer.service';
import { LocalhostOnlyGuard } from './localhost-only.guard';
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options';

/**
 * This Controller exposes the necessary HTTP endpoints for the bridge to collect runtime information.
 * The default endpoint path is /_dev/mcp
 */
@Controller('_dev/mcp')
@UseGuards(LocalhostOnlyGuard)
export class DevtoolsMcpController {
  private readonly version = '0.1.0';

  constructor(
    private readonly logBuffer: LogBufferService,
    @Inject(DEVTOOLS_OPTIONS_TOKEN)
    private readonly options: DevtoolsMcpOptions,
  ) {}

  /**
   * Endpoint for health checks and bridge auto-discovery.
   */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      name: 'nestjs-devtools-mcp',
      version: this.version,
      nestVersion: 'unknown', // To be updated later from DiscoveryService if needed
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
    };
  }

  /**
   * Endpoint allowing the bridge to retrieve log entries temporarily stored in the buffer.
   * @param body Filter parameters: lines, level and since
   */
  @Post('tools/get_logs')
  getLogs(
    @Body() body: { lines?: number; level?: string; since?: number },
  ) {
    const lines = body.lines || 50;
    const level = body.level || 'all';
    
    const entries = this.logBuffer.getLogs(lines, level);
    const stats = this.logBuffer.getStats();

    return {
      entries,
      ...stats,
    };
  }
}
