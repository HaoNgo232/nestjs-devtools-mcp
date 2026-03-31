import { discoverServers, NestServerInfo } from './discovery.js';

/**
 * Lớp xử lý proxy request từ MCP server tới plugin đang chạy trong NestJS app.
 */
export class DevToolsProxy {
  private lastSelectedPort: number | null = null;

  /**
   * Tự động xác định port của NestJS server để thực hiện tool call.
   * Ưu tiên server duy nhất tìm thấy hoặc port được user cung cấp.
   */
  async resolvePort(explicitPort?: number): Promise<number> {
    if (explicitPort) {
      this.lastSelectedPort = explicitPort;
      return explicitPort;
    }

    const instances = await discoverServers();
    if (instances.length === 1) {
      this.lastSelectedPort = instances[0].port;
      return instances[0].port;
    }

    if (instances.length > 1) {
      throw new Error(`Nhiều server NestJS được tìm thấy trên các port (${instances.map(i => i.port).join(', ')}). Vui lòng cung cấp chính xác port mong muốn.`);
    }

    throw new Error('Không tìm thấy NestJS server nào đang chạy DevTools MCP plugin (port 3000-3010). Hãy đảm bảo plugin đã được install và import.');
  }

  /**
   * Gọi HTTP request tới endpoint cụ thể của plugin.
   */
  async callPluginTool(port: number, toolName: string, payload: unknown = {}): Promise<unknown> {
    const url = `http://localhost:${port}/_dev/mcp/tools/${toolName}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Plugin error (HTTP ${response.status}): ${errorText}`);
    }

    return await response.json();
  }
}
