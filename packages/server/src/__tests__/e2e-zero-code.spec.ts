import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'

describe('E2E Zero-Code Runtime Preload', () => {
  let child: ChildProcess | null = null
  const TEST_PORT = 3098

  afterEach(async () => {
    if (child && !child.killed) {
      child.kill('SIGTERM')
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  })

  it('should auto-inject DevTools MCP into a pure NestJS application via NODE_OPTIONS', async () => {
    const registerPath = path.resolve(__dirname, '../../dist/register.js')
    const testAppScript = `
      require('reflect-metadata');
      const { Module, Controller, Get } = require('@nestjs/common');
      const { NestFactory } = require('@nestjs/core');

      class TestHelloController {
        getHello() {
          return { status: 'hello-world' };
        }
      }
      Controller('test-hello')(TestHelloController);
      Get()(TestHelloController.prototype, 'getHello', Object.getOwnPropertyDescriptor(TestHelloController.prototype, 'getHello'));

      class PureAppModule {}
      Module({
        controllers: [TestHelloController],
      })(PureAppModule);

      async function bootstrap() {
        const app = await NestFactory.create(PureAppModule, { logger: false });
        await app.listen(${TEST_PORT});
      }

      bootstrap();
    `

    child = spawn(process.execPath, ['-e', testAppScript], {
      cwd: path.resolve(__dirname, '../../../../test-nestjs-app'),
      env: {
        ...process.env,
        NODE_OPTIONS: `--require "${registerPath}"`,
      },
      stdio: 'pipe',
    })

    let started = false
    const timeout = Date.now() + 10000

    while (Date.now() < timeout) {
      try {
        const res = await fetch(`http://localhost:${TEST_PORT}/_dev/mcp/health`)
        if (res.ok) {
          started = true
          break
        }
      } catch (_e) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    expect(started).toBe(true)

    // 1. Verify health endpoint
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/_dev/mcp/health`)
    expect(healthRes.status).toBe(200)
    const healthJson = (await healthRes.json()) as any
    const healthData = healthJson.data || healthJson

    expect(healthData.status).toBe('ok')
    expect(healthData.module).toBe('nestjs-devtools-mcp')
    expect(healthData.tools).toContain('get_routes')
    expect(healthData.tools).toContain('get_logs')

    // 2. Verify get_routes collector
    const routesRes = await fetch(`http://localhost:${TEST_PORT}/_dev/mcp/tools/get_routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect([200, 201]).toContain(routesRes.status)
    const routesJson = (await routesRes.json()) as any
    const routesData = routesJson.data || routesJson
    expect(routesData.routes.some((r: any) => r.path.startsWith('/test-hello'))).toBe(true)

    // 3. Verify standard application endpoint still works
    const appRes = await fetch(`http://localhost:${TEST_PORT}/test-hello`)
    expect(appRes.status).toBe(200)
    const appJson = (await appRes.json()) as any
    expect(appJson.status).toBe('hello-world')
  }, 15000)
})
