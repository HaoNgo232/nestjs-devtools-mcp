import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { patchNestFactory } from '../register'
import { DevtoolsMcpModule } from '@nestjs-devtools-mcp/plugin'

describe('Zero-Code Preload Hook (register.ts)', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it('should inject DevtoolsMcpModule into an unmodified root module during NestFactory.create', async () => {
    // Unmodified root module without DevtoolsMcpModule
    class SampleAppModule {}
    Module({ imports: [] })(SampleAppModule)

    // Ensure hook is attached to NestFactory
    patchNestFactory(NestFactory)

    // Verify before create: imports metadata does not have DevtoolsMcpModule
    const beforeImports = Reflect.getMetadata('imports', SampleAppModule) || []
    expect(beforeImports).toHaveLength(0)

    // Call NestFactory.create
    const app = await NestFactory.create(SampleAppModule, { logger: false })
    await app.init()

    // Verify after create: imports metadata now contains DevtoolsMcpModule
    const afterImports = Reflect.getMetadata('imports', SampleAppModule) || []
    expect(afterImports.length).toBeGreaterThan(0)
    const hasDevtools = afterImports.some(
      (imp: any) => imp === DevtoolsMcpModule || (imp && imp.module === DevtoolsMcpModule),
    )
    expect(hasDevtools).toBe(true)

    // Verify endpoint controller is registered
    const controller = app.get(DevtoolsMcpModule)
    expect(controller).toBeDefined()

    await app.close()
  })

  it('should not inject DevtoolsMcpModule when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production'

    class ProdAppModule {}
    Module({ imports: [] })(ProdAppModule)

    patchNestFactory(NestFactory)

    const app = await NestFactory.create(ProdAppModule, { logger: false })
    await app.init()

    const imports = Reflect.getMetadata('imports', ProdAppModule) || []
    expect(imports).toHaveLength(0)

    await app.close()
  })

  it('should avoid duplicate injection if DevtoolsMcpModule is already in imports', async () => {
    class AlreadyConfiguredModule {}
    Module({ imports: [DevtoolsMcpModule.register()] })(AlreadyConfiguredModule)

    patchNestFactory(NestFactory)

    const beforeImports = Reflect.getMetadata('imports', AlreadyConfiguredModule) || []
    expect(beforeImports).toHaveLength(1)

    const app = await NestFactory.create(AlreadyConfiguredModule, { logger: false })
    await app.init()

    const afterImports = Reflect.getMetadata('imports', AlreadyConfiguredModule) || []
    expect(afterImports).toHaveLength(1)

    await app.close()
  })

  it('should force bufferLogs to true when options are passed', async () => {
    class LogTestModule {}
    Module({ imports: [] })(LogTestModule)

    patchNestFactory(NestFactory)

    const options: any = { logger: false }
    const app = await NestFactory.create(LogTestModule, options)
    await app.init()

    expect(options.bufferLogs).toBe(true)

    await app.close()
  })
})
