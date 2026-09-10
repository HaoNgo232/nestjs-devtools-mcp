import { spawn, ChildProcess } from 'child_process'
import * as http from 'http'
import * as path from 'path'

const NESTJS_PORT = 3005

function makeRequest(method: string, urlPath: string, payload?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: NESTJS_PORT,
        path: urlPath,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {},
      },
      () => resolve(),
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function waitForNestJsReady(timeoutMs = 15000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${NESTJS_PORT}/hello`)
      if (res.ok) return
    } catch {
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  throw new Error('Timeout waiting for NestJS app')
}

async function main() {
  console.log('🚀 Testing Full Tool Suite & New Features against Real NestJS App...\n')
  let nestApp: ChildProcess | null = null
  let mcpProcess: ChildProcess | null = null

  try {
    const appDir = path.resolve(__dirname, '../test-nestjs-app')
    const tsNodeBin = path.resolve(appDir, 'node_modules/.bin/ts-node')
    nestApp = spawn(tsNodeBin, ['main.ts'], {
      cwd: appDir,
      env: {
        ...process.env,
        DATABASE_URL: 'postgres://postgres:mypassword@localhost:5432/testdb',
        SECRET_KEY: 'super-sensitive-jwt-token',
      },
    })

    await waitForNestJsReady()
    console.log('🟢 Real NestJS App is running at http://localhost:3005')

    // Generate traffic & error
    await makeRequest('GET', '/hello')
    await makeRequest('POST', '/products', JSON.stringify({ name: 'Laptop Pro' }))
    await makeRequest('GET', '/errors/5xx').catch(() => {})

    // Launch MCP Server
    const serverScript = path.resolve(__dirname, '../packages/server/dist/index.js')
    mcpProcess = spawn('node', [serverScript])

    let jsonRpcId = 1
    const callTool = (name: string, args: Record<string, unknown>): Promise<any> => {
      return new Promise((resolve) => {
        const id = jsonRpcId++
        const payload =
          JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name, arguments: args }, id }) + '\n'
        let buffer = ''

        const onData = (data: Buffer) => {
          buffer += data.toString()
          const lines = buffer.split('\n')
          for (let i = 0; i < lines.length - 1; i++) {
            try {
              const res = JSON.parse(lines[i])
              if (res.id === id) {
                mcpProcess?.stdout?.removeListener('data', onData)
                resolve(res.result)
                return
              }
            } catch {}
          }
          buffer = lines[lines.length - 1]
        }

        mcpProcess?.stdout?.on('data', onData)
        mcpProcess?.stdin?.write(payload)
      })
    }

    await new Promise((r) => setTimeout(r, 1000))

    // 1. Test nestjs_discover_servers
    console.log('1. Testing nestjs_discover_servers...')
    const res1 = await callTool('nestjs_discover_servers', { response_format: 'markdown' })
    if (!res1.content[0].text.includes('3005')) throw new Error('nestjs_discover_servers failed')
    console.log('   ✅ nestjs_discover_servers PASSED')

    // 2. Test nestjs_diagnose_health (Before clear)
    console.log('2. Testing nestjs_diagnose_health (With simulated crash)...')
    const resDiag1 = await callTool('nestjs_diagnose_health', { port: 3005, response_format: 'markdown' })
    console.log(resDiag1.content[0].text)
    if (
      !resDiag1.content[0].text.includes('Database connection failed') ||
      !resDiag1.structuredContent.errors.recent.length
    ) {
      throw new Error('nestjs_diagnose_health failed to capture crash error')
    }
    console.log('   ✅ nestjs_diagnose_health PASSED (Detected 500 error & traffic stats)')

    // 3. Test nestjs_clear_buffers
    console.log('3. Testing nestjs_clear_buffers...')
    const resClear = await callTool('nestjs_clear_buffers', { port: 3005, target: 'all' })
    console.log(resClear.content[0].text)
    if (resClear.structuredContent.totalCleared <= 0) {
      throw new Error('nestjs_clear_buffers failed to clear records')
    }
    console.log('   ✅ nestjs_clear_buffers PASSED (Cleared in-memory records)')

    // 4. Test nestjs_diagnose_health (After clear) -> Must be clean!
    console.log('4. Testing nestjs_diagnose_health after clear (Must be clean)...')
    const resDiag2 = await callTool('nestjs_diagnose_health', { port: 3005, response_format: 'markdown' })
    console.log(resDiag2.content[0].text)
    if (!resDiag2.content[0].text.includes('No errors recorded in the buffer')) {
      throw new Error('nestjs_diagnose_health should report zero errors after buffer clear')
    }
    console.log('   ✅ nestjs_diagnose_health PASSED (Clean slate verified)')

    console.log('\n🎉 ALL REAL APP E2E TESTS PASSED WITH 100% SUCCESS! 🎉')
  } finally {
    mcpProcess?.kill()
    nestApp?.kill()
  }
}

main().catch((err) => {
  console.error('❌ E2E test failed:', err)
  process.exit(1)
})
