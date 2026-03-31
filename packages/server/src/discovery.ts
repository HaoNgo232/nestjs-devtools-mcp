export interface NestServerInfo {
  port: number;
  pid: number;
  name: string;
  version: string;
  uptime: number;
  healthUrl: string;
}

/**
 * Scan các port trong một khoảng nhất định để tìm server NestJS có cài plugin DevtoolsMcp.
 * @param startPort Port bắt đầu scan.
 * @param endPort Port kết thúc scan.
 */
export async function discoverServers(startPort = 3000, endPort = 3010): Promise<NestServerInfo[]> {
  const servers: NestServerInfo[] = [];
  const ports = Array.from({ length: endPort - startPort + 1 }, (_, i) => startPort + i);

  // Scan các port song song để tăng hiệu suất
  const results = await Promise.allSettled(
    ports.map(async (port) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600); // Timeout ngắn cho việc scan

      try {
        const response = await fetch(`http://localhost:${port}/_dev/mcp/health`, {
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.name === 'nestjs-devtools-mcp') {
            return {
              port,
              pid: data.pid,
              name: data.name,
              version: data.version,
              uptime: data.uptime,
              healthUrl: `http://localhost:${port}/_dev/mcp/health`,
            };
          }
        }
      } catch (err) {
        // Ignored
      } finally {
        clearTimeout(timeoutId);
      }
      return null;
    })
  );

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value) {
      servers.push(res.value);
    }
  }

  return servers;
}
