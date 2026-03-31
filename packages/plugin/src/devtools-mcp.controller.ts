import { Controller, Get, Post, Body, UseGuards, Query, Inject } from '@nestjs/common';
import { LogBufferService } from './log-buffer.service';
import { LocalhostOnlyGuard } from './localhost-only.guard';
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options';

/**
 * Controller này expose các HTTP endpoint cần thiết để bridge có thể thu thập thông tin runtime.
 * Endpoint path được mặc định là /_dev/mcp
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
   * Endpoint phục vụ cho việc kiểm tra sức khỏe và tự phát hiện (auto-discovery) của bridge.
   */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      name: 'nestjs-devtools-mcp',
      version: this.version,
      nestVersion: 'unknown', // Có thể update sau từ DiscoveryService nếu cần
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
    };
  }

  /**
   * Endpoint cho phép bridge lấy các log entry được lưu trữ tạm thời trong buffer.
   * @param body Các tham số lọc lines, level và since
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
