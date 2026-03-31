export interface NestServerInfo {
  port: number
  pid: number
  name: string
  version: string
  uptime: number
  healthUrl: string
}

import { execSync } from 'child_process'

const DEFAULT_START_PORT = Number(process.env.NESTJS_MCP_SCAN_START) || 3000
const DEFAULT_END_PORT = Number(process.env.NESTJS_MCP_SCAN_END) || 3010

/**
 * Lấy danh sách các cổng mà các process Node.js đang listen thực tế trên hệ thống.
 * Đây là chìa khóa của "Zero Config".
 */
function getListenPorts(): number[] {
  try {
    const isLinux = process.platform === 'linux'
    const isMac = process.platform === 'darwin'
    let command = ''

    if (isLinux || isMac) {
      // Tìm các port đang LISTEN của process node
      command = "lsof -i -P -n | grep LISTEN | grep node | awk '{print $9}' | cut -d: -f2 | sort -u"
    } else if (process.platform === 'win32') {
      // Windows version (đòi hỏi netstat)
      command = 'netstat -ano | findstr LISTENING | findstr :3000 :3001 :4000 :8080' // Windows fallback
    }

    if (!command) return []
    const out = execSync(command).toString()
    return out
      .split('\n')
      .map((p) => parseInt(p.trim(), 10))
      .filter((p) => !isNaN(p))
  } catch (_err) {
    return []
  }
}

/**
 * Scan ports in a specific range to find NestJS servers with the DevtoolsMcp plugin installed.
 * @param startPort Starting port for scanning.
 * @param endPort Ending port for scanning.
 */
export async function discoverServers(
  startPort = DEFAULT_START_PORT,
  endPort = DEFAULT_END_PORT,
): Promise<NestServerInfo[]> {
  const servers: NestServerInfo[] = []

  // Bước 1: Tổng hợp các ports cần quét (Listen ports thực tế + dải mặc định để fallback)
  const listenPorts = getListenPorts()
  const rangePorts = Array.from({ length: endPort - startPort + 1 }, (_, i) => startPort + i)
  const portsToScan = [...new Set([...listenPorts, ...rangePorts])]

  // Bước 2: Thử các prefix phổ biến nếu /_dev/mcp/health không phản hồi ở root
  const prefixes = ['', '/api', '/v1']

  // Scan ports in parallel to increase performance
  const results = await Promise.allSettled(
    portsToScan.map(async (port) => {
      // Thử từng prefix cho mỗi port
      for (const prefix of prefixes) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 400) // Timeout ngắn hơn cho scan nhanh
        const url = `http://localhost:${port}${prefix}/_dev/mcp/health`

        try {
          const response = await fetch(url, {
            signal: controller.signal,
          })

          if (response.ok) {
            const json = await response.json()
            const data = json.data ?? json

            if (data.name === 'nestjs-devtools-mcp' || data.module === 'nestjs-devtools-mcp') {
              clearTimeout(timeoutId)
              return {
                port,
                pid: data.pid,
                name: data.name,
                version: data.version,
                uptime: data.uptime,
                healthUrl: url,
              }
            }
          }
        } catch (_err) {
          // Ignored
        } finally {
          clearTimeout(timeoutId)
        }
      }
      return null
    }),
  )

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value) {
      servers.push(res.value)
    }
  }

  return servers
}
