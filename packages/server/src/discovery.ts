export interface NestServerInfo {
  port: number;
  pid: number;
  name: string;
  version: string;
  uptime: number;
  healthUrl: string;
}

/**
 * Scan ports in a specific range to find NestJS servers with the DevtoolsMcp plugin installed.
 * @param startPort Starting port for scanning.
 * @param endPort Ending port for scanning.
 */
export async function discoverServers(startPort = 3000, endPort = 3010): Promise<NestServerInfo[]> {
  const servers: NestServerInfo[] = [];
  const ports = Array.from({ length: endPort - startPort + 1 }, (_, i) => startPort + i);

  // Scan ports in parallel to increase performance
  const results = await Promise.allSettled(
    ports.map(async (port) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600); // Short timeout for scanning

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
