import { spawn, ChildProcess } from 'child_process'
import * as http from 'http'
import * as path from 'path'

const NESTJS_PORT = 3005
const NESTJS_URL = `http://localhost:${NESTJS_PORT}`

// Helper function to make an HTTP request to the NestJS application
function makeRequest(
  method: string,
  urlPath: string,
  payload?: string,
): Promise<{ statusCode?: number; body: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: NESTJS_PORT,
      path: urlPath,
      method: method,
      headers: payload
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          }
        : {},
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data })
      })
    })

    req.on('error', (err) => reject(err))
    if (payload) {
      req.write(payload)
    }
    req.end()
  })
}

// Poll the NestJS health/hello endpoint until it is ready
function waitForNestJsReady(timeoutMs = 15000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await makeRequest('GET', '/hello')
        if (res.statusCode === 200) {
          resolve()
          return
        }
      } catch (err) {
        // App is not ready yet
      }

      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for NestJS app on port ${NESTJS_PORT} to be ready.`))
      } else {
        setTimeout(check, 500)
      }
    }
    check()
  })
}

// Main E2E QA Test Runner
async function runE2ETests() {
  console.log('🤖 Starting E2E Integration QA Tests...')
  let nestAppProcess: ChildProcess | null = null
  let mcpProcess: ChildProcess | null = null

  try {
    // 1. Khởi chạy NestJS application trong test-nestjs-app
    const appDir = path.resolve(__dirname, '../test-nestjs-app')
    const tsNodeBin = path.resolve(appDir, 'node_modules/.bin/ts-node')
    nestAppProcess = spawn(tsNodeBin, ['main.ts'], {


      cwd: appDir,
      env: {
        ...process.env,
        DATABASE_URL: 'mongodb://admin:secretPassword123@localhost:27017/db',
        JWT_SECRET: 'mySuperSecretTokenValue',
      },
    })

    nestAppProcess.stderr?.on('data', (data) => {
      console.error(`[NestJS Stderr] ${data.toString().trim()}`)
    })

    nestAppProcess.stdout?.on('data', (data) => {
      // Debug logs from NestJS if needed
      // console.log(`[NestJS] ${data.toString().trim()}`);
    })

    await waitForNestJsReady()
    console.log('🟢 NestJS App is ready and running.')

    // 2. Tạo một vài HTTP requests để có log và request history và error history
    console.log('Step 2: Sending mock HTTP traffic and triggering errors in NestJS...')
    await makeRequest('GET', '/hello')
    await makeRequest('POST', '/products', JSON.stringify({ name: 'E2E Product' }))
    await makeRequest('GET', '/notexist').catch(() => {}) // Sẽ sinh ra log 404
    await makeRequest('GET', '/errors/runtime')
    await makeRequest('GET', '/errors/5xx').catch(() => {})
    await makeRequest('GET', '/errors/unhandled-rejection')
    await new Promise((resolve) => setTimeout(resolve, 200)) // Đợi async rejection được ghi vào buffer


    // 3. Khởi chạy MCP Server sử dụng npx trỏ tới build local
    console.log('Step 3: Spawning MCP Server Bridge using npx...')
    const serverScript = path.resolve(__dirname, '../packages/server/dist/index.js')

    // Khởi chạy qua npx
    mcpProcess = spawn('npx', [serverScript])

    mcpProcess.stderr?.on('data', (data) => {
      console.log(`[MCP Bridge Stderr/Logs] ${data.toString().trim()}`)
    })

    // Helper to send JSON-RPC command to MCP Server and get response
    let jsonRpcId = 1
    const sendMcpCommand = (method: string, params: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        const id = jsonRpcId++
        const requestPayload =
          JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id,
          }) + '\n'

        let stdoutData = ''

        const onData = (data: Buffer) => {
          stdoutData += data.toString()

          // Chờ cho đến khi nhận được một dòng JSON đầy đủ (kết thúc bằng \n)
          const lines = stdoutData.split('\n')
          for (let i = 0; i < lines.length - 1; i++) {
            try {
              const response = JSON.parse(lines[i])
              if (response.id === id) {
                mcpProcess?.stdout?.removeListener('data', onData)
                resolve(response)
                return
              }
            } catch (err) {
              // Dòng chưa hoàn chỉnh hoặc không phải JSON hợp lệ
            }
          }
          // Giữ lại phần chưa phân tích được
          stdoutData = lines[lines.length - 1]
        }

        mcpProcess?.stdout?.on('data', onData)
        mcpProcess?.stdin?.write(requestPayload)
      })
    }

    // Đợi 1 giây để MCP server khởi động hoàn tất
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // ==========================================
    // QA-1: Test discover_servers & npx startup
    // ==========================================
    console.log('🔍 Executing QA-1: discover_servers...')
    const q1Response = await sendMcpCommand('tools/call', {
      name: 'discover_servers',
      arguments: {},
    })

    if (q1Response.result?.isError) {
      throw new Error(`QA-1 failed: discover_servers returned error: ${q1Response.result.content[0].text}`)
    }

    const servers = JSON.parse(q1Response.result.content[0].text)
    console.log('Discovered Servers:', servers)
    const targetServer = servers.find((s: any) => s.port === NESTJS_PORT)
    if (!targetServer) {
      throw new Error(`QA-1 failed: Could not discover NestJS server running on port ${NESTJS_PORT}`)
    }
    console.log('✅ QA-1 PASS: Server discovered and started successfully via npx.')

    // ==========================================
    // QA-2: Test get_logs
    // ==========================================
    console.log('🔍 Executing QA-2: get_logs...')
    const q2Response = await sendMcpCommand('tools/call', {
      name: 'get_logs',
      arguments: { port: NESTJS_PORT, lines: 20 },
    })

    if (q2Response.result?.isError) {
      throw new Error(`QA-2 failed: get_logs returned error: ${q2Response.result.content[0].text}`)
    }

    const logResult = JSON.parse(q2Response.result.content[0].text)
    const hasHelloLog = logResult.entries.some((l: any) => l.message.includes('Hello route has been called!'))
    if (!hasHelloLog) {
      throw new Error('QA-2 failed: "Hello route has been called!" log not found in log buffer.')
    }
    console.log('✅ QA-2 PASS: Captured runtime logs successfully.')

    // ==========================================
    // QA-3: Test get_routes
    // ==========================================
    console.log('🔍 Executing QA-3: get_routes...')
    const q3Response = await sendMcpCommand('tools/call', {
      name: 'get_routes',
      arguments: { port: NESTJS_PORT },
    })

    if (q3Response.result?.isError) {
      throw new Error(`QA-3 failed: get_routes returned error: ${q3Response.result.content[0].text}`)
    }

    const routesResult = JSON.parse(q3Response.result.content[0].text)
    const routePaths = routesResult.routes.map((r: any) => r.path)
    const hasHello = routePaths.some((p: string) => p === '/hello' || p === '/hello/')
    const hasProducts = routePaths.some((p: string) => p === '/products' || p === '/products/')
    if (!hasHello || !hasProducts) {
      throw new Error(`QA-3 failed: Missing expected routes /hello or /products. Found: ${routePaths.join(', ')}`)
    }
    console.log('✅ QA-3 PASS: Mapped all routes accurately.')

    // ==========================================
    // QA-4: Test get_request_history
    // ==========================================
    console.log('🔍 Executing QA-4: get_request_history...')

    // Kiểm thử lọc onlyErrors
    const q4ErrResponse = await sendMcpCommand('tools/call', {
      name: 'get_request_history',
      arguments: { port: NESTJS_PORT, onlyErrors: true },
    })
    const errorHistory = JSON.parse(q4ErrResponse.result.content[0].text)
    const allAreErrors = errorHistory.entries.every((e: any) => e.statusCode >= 400)
    const has404 = errorHistory.entries.some((e: any) => e.path === '/notexist' && e.statusCode === 404)

    if (!allAreErrors || !has404) {
      throw new Error(
        `QA-4 failed: onlyErrors filter did not work correctly. entries: ${JSON.stringify(errorHistory.entries)}`,
      )
    }

    // Kiểm thử lọc method: POST
    const q4PostResponse = await sendMcpCommand('tools/call', {
      name: 'get_request_history',
      arguments: { port: NESTJS_PORT, method: 'POST' },
    })
    const postHistory = JSON.parse(q4PostResponse.result.content[0].text)
    const allArePost = postHistory.entries.every((e: any) => e.method === 'POST')
    const hasProductsPost = postHistory.entries.some((e: any) => e.path === '/products')

    if (!allArePost || !hasProductsPost) {
      throw new Error(`QA-4 failed: method POST filter did not work correctly.`)
    }

    // Kiểm tra không chứa request nội bộ mcp
    const hasInternalMcp = postHistory.entries.some((e: any) => e.path.includes('/_dev/mcp'))
    if (hasInternalMcp) {
      throw new Error('QA-4 failed: Traffic history contains internal /_dev/mcp requests.')
    }

    console.log('✅ QA-4 PASS: Request history filters and masking of internal calls verified.')

    // ==========================================
    // QA-5: Test get_config (masking)
    // ==========================================
    console.log('🔍 Executing QA-5: get_config (masking)...')
    const q5Response = await sendMcpCommand('tools/call', {
      name: 'get_config',
      arguments: { port: NESTJS_PORT, source: 'env' },
    })

    if (q5Response.result?.isError) {
      throw new Error(`QA-5 failed: get_config returned error: ${q5Response.result.content[0].text}`)
    }

    const configResult = JSON.parse(q5Response.result.content[0].text)
    const dbUrlEntry = configResult.entries.find((e: any) => e.key === 'DATABASE_URL')
    const jwtSecretEntry = configResult.entries.find((e: any) => e.key === 'JWT_SECRET')

    if (!dbUrlEntry || dbUrlEntry.value !== '***MASKED***') {
      throw new Error(`QA-5 failed: DATABASE_URL not masked correctly. Value is: ${dbUrlEntry?.value}`)
    }
    if (!jwtSecretEntry || jwtSecretEntry.value !== '***MASKED***') {
      throw new Error(`QA-5 failed: JWT_SECRET not masked correctly. Value is: ${jwtSecretEntry?.value}`)
    }

    // ==========================================
    // QA-6: Test get_errors
    // ==========================================
    console.log('🔍 Executing QA-6: get_errors...')
    const q6Response = await sendMcpCommand('tools/call', {
      name: 'get_errors',
      arguments: { port: NESTJS_PORT, includeStack: true },
    })

    if (q6Response.result?.isError) {
      throw new Error(`QA-6 failed: get_errors returned error: ${q6Response.result.content[0].text}`)
    }

    const errorResult = JSON.parse(q6Response.result.content[0].text)
    console.log('Get Errors Result:', errorResult)

    const hasRuntime = errorResult.entries.some((e: any) => e.source === 'runtime' && e.message.includes('Custom runtime error'))
    const has5xx = errorResult.entries.some((e: any) => e.source === 'http-5xx' && e.message.includes('Database connection failed'))
    const hasUnhandled = errorResult.entries.some((e: any) => e.source === 'unhandled' && e.message.includes('Async unhandled rejection'))

    if (!hasRuntime || !has5xx || !hasUnhandled) {
      throw new Error(`QA-6 failed: Missing expected error entries. Runtime: ${hasRuntime}, 5xx: ${has5xx}, Unhandled: ${hasUnhandled}`)
    }

    // Lọc theo source: unhandled
    const q6UnhandledResponse = await sendMcpCommand('tools/call', {
      name: 'get_errors',
      arguments: { port: NESTJS_PORT, source: 'unhandled' },
    })
    const unhandledResult = JSON.parse(q6UnhandledResponse.result.content[0].text)
    const allAreUnhandled = unhandledResult.entries.every((e: any) => e.source === 'unhandled')
    if (!allAreUnhandled || unhandledResult.entries.length === 0) {
      throw new Error('QA-6 failed: Filter by source unhandled failed.')
    }

    console.log('✅ QA-6 PASS: get_errors retrieved and filtered errors from all sources correctly.')

    console.log('\n🎉 ALL 6 QA E2E TESTS PASSED SUCCESSFULLY! 🎉\n')
  } catch (error) {
    console.error('❌ E2E QA Test failed:', error)
    process.exitCode = 1
  } finally {
    console.log('🧹 Cleaning up child processes...')
    if (mcpProcess) {
      mcpProcess.kill()
    }
    if (nestAppProcess) {
      nestAppProcess.kill()
    }
    console.log('Done.')
  }
}

runE2ETests()

