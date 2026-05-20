import { ModuleRef } from '@nestjs/core'
import { ConfigCollector, ConfigCollectorData } from '../config.collector'

describe('ConfigCollector', () => {
  const originalEnv = process.env
  let collector: ConfigCollector
  let moduleRef: jest.Mocked<Pick<ModuleRef, 'get'>>

  function entryByKey(data: ConfigCollectorData, key: string): ConfigCollectorData['entries'][number] {
    const entry = data.entries.find((item) => item.key === key)
    if (!entry) {
      throw new Error(`Missing config entry: ${key}`)
    }

    return entry
  }

  beforeEach(() => {
    process.env = {
      NODE_ENV: 'test',
      PORT: '3000',
      HOST: '127.0.0.1',
      TZ: 'Asia/Ho_Chi_Minh',
      LANG: 'en_US.UTF-8',
      PUBLIC_FLAG: 'enabled',
      EMPTY_VALUE: '',
      API_TOKEN: 'secret-token',
      URL_WITH_SECRET: 'Bearer abcdefghijklmnop',
    }

    moduleRef = {
      get: jest.fn().mockImplementation(() => {
        throw new Error('missing provider')
      }),
    }

    collector = new ConfigCollector(moduleRef as unknown as ModuleRef)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('exposes the get_config tool identity and exact description', () => {
    expect(collector.toolName).toBe('get_config')
    expect(collector.description).toBe(
      'Dump current runtime configuration from process.env and @nestjs/config ConfigService. Sensitive values are auto-masked.',
    )
  })

  it('whitelists only safe env values and otherwise returns status without raw values', async () => {
    const result = await collector.execute({ source: 'env' })

    expect(entryByKey(result.data, 'NODE_ENV')).toMatchObject({
      source: 'env',
      status: 'set',
      masked: false,
      value: 'test',
    })
    expect(entryByKey(result.data, 'PORT').value).toBe('3000')

    const publicFlag = entryByKey(result.data, 'PUBLIC_FLAG')
    expect(publicFlag).toMatchObject({ source: 'env', status: 'set', masked: false })
    expect(publicFlag).toMatchObject({ value: null, type: 'undefined' })

    const emptyValue = entryByKey(result.data, 'EMPTY_VALUE')
    expect(emptyValue).toMatchObject({ source: 'env', status: 'empty', masked: false })
    expect(emptyValue).toMatchObject({ value: null, type: 'string' })
  })

  it('masks env entries by sensitive key and sensitive value patterns', async () => {
    const result = await collector.execute({ source: 'env' })

    expect(entryByKey(result.data, 'API_TOKEN')).toEqual({
      source: 'env',
      key: 'API_TOKEN',
      status: 'masked',
      masked: true,
      value: '***MASKED***',
      type: 'string',
    })
    expect(entryByKey(result.data, 'URL_WITH_SECRET')).toMatchObject({
      status: 'masked',
      masked: true,
      value: '***MASKED***',
    })
  })

  it('filters by source and key substring', async () => {
    moduleRef.get.mockReturnValue({
      internalConfig: {
        database: {
          host: 'localhost',
          port: 5432,
        },
      },
    } as never)

    const result = await collector.execute({ source: 'config-service', keyContains: 'HOST' })

    expect(result.data.entries).toEqual([
      {
        source: 'config-service',
        key: 'database.host',
        status: 'set',
        masked: false,
        value: 'localhost',
        type: 'string',
      },
    ])
    expect(result.data.total).toBe(1)
  })

  it('omits masked entries when includeMasked is false', async () => {
    moduleRef.get.mockReturnValue({
      internalConfig: {
        jwtSecret: 'super-secret',
        featureFlag: true,
      },
    } as never)

    const result = await collector.execute({ includeMasked: false })

    expect(result.data.entries.some((entry) => entry.masked)).toBe(false)
    expect(result.data.entries.map((entry) => entry.key)).toContain('featureFlag')
    expect(result.data.entries.map((entry) => entry.key)).not.toContain('jwtSecret')
    expect(result.data.entries.map((entry) => entry.key)).not.toContain('API_TOKEN')
  })

  it('returns a clear warning when ConfigService is unavailable', async () => {
    const result = await collector.execute({ source: 'config-service' })

    expect(result.data.configServiceAvailable).toBe(false)
    expect(result.data.entries).toEqual([])
    expect(result.data.warnings).toEqual([
      'ConfigService unavailable: @nestjs/config is not installed or ConfigModule is not registered.',
    ])
  })

  it('flattens ConfigService internalConfig and masks sensitive config keys and values', async () => {
    moduleRef.get.mockReturnValue({
      internalConfig: {
        database: {
          host: 'localhost',
          password: 'do-not-leak',
        },
        callbackUrl: 'Bearer abcdefghijklmnop',
      },
    } as never)

    const result = await collector.execute({ source: 'config-service' })

    expect(entryByKey(result.data, 'database.host')).toMatchObject({
      source: 'config-service',
      status: 'set',
      masked: false,
      value: 'localhost',
    })
    expect(entryByKey(result.data, 'database.password')).toMatchObject({
      status: 'masked',
      masked: true,
      value: '***MASKED***',
    })
    expect(entryByKey(result.data, 'callbackUrl')).toMatchObject({
      status: 'masked',
      masked: true,
      value: '***MASKED***',
    })
    expect(result.data.configServiceAvailable).toBe(true)
  })

  it('serializes arrays, truncates long strings, and marks functions', async () => {
    const longValue = 'x'.repeat(1100)
    moduleRef.get.mockReturnValue({
      internalConfig: {
        list: ['a', 'b'],
        longValue,
        handler: () => 'unused',
      },
    } as never)

    const result = await collector.execute({ source: 'config-service' })

    expect(entryByKey(result.data, 'list')).toMatchObject({ value: '["a","b"]' })
    expect(entryByKey(result.data, 'handler')).toMatchObject({ value: '[Function]' })

    const truncated = entryByKey(result.data, 'longValue').value
    expect(typeof truncated).toBe('string')
    expect((truncated as string).length).toBe(1027)
    expect(truncated).toMatch(/\.\.\.$/)
  })

  it('marks circular ConfigService values without throwing', async () => {
    const circular: Record<string, unknown> = { name: 'root' }
    circular.self = circular

    moduleRef.get.mockReturnValue({
      internalConfig: {
        circular,
      },
    } as never)

    const result = await collector.execute({ source: 'config-service' })

    expect(entryByKey(result.data, 'circular.name')).toMatchObject({ value: 'root' })
    expect(entryByKey(result.data, 'circular.self')).toMatchObject({
      status: 'set',
      masked: false,
      value: '[Circular]',
    })
  })
})
