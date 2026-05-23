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

  describe('ConfigCollector — public API only', () => {
    it('does not read internalConfig or _internalConfig reflectively', async () => {
      const fakeConfigService = {
        internalConfig: { SECRET_DATA: 'should-not-appear' },
        _internalConfig: { ANOTHER: 'should-not-appear' },
        get: jest.fn((key: string) => undefined),
      }
      moduleRef.get.mockReturnValue(fakeConfigService)

      const result = await collector.execute({ source: 'config-service' })

      const keys = result.data.entries.map((e) => e.key)
      expect(keys).not.toContain('SECRET_DATA')
      expect(keys).not.toContain('ANOTHER')
    })

    it('reads only declared keys via configService.get()', async () => {
      process.env.NESTJS_MCP_CONFIG_KEYS = 'APP_NAME,DATABASE_HOST'
      const fakeConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'APP_NAME') return 'demo'
          if (key === 'DATABASE_HOST') return 'localhost'
          return undefined
        }),
      }
      moduleRef.get.mockReturnValue(fakeConfigService)

      const result = await collector.execute({ source: 'config-service' })

      expect(fakeConfigService.get).toHaveBeenCalledWith('APP_NAME')
      expect(fakeConfigService.get).toHaveBeenCalledWith('DATABASE_HOST')
      expect(result.data.entries.map((e) => e.key)).toEqual(expect.arrayContaining(['APP_NAME', 'DATABASE_HOST']))
      expect(entryByKey(result.data, 'APP_NAME').value).toBe('demo')
      expect(entryByKey(result.data, 'DATABASE_HOST').value).toBe('localhost')
      delete process.env.NESTJS_MCP_CONFIG_KEYS
    })

    it('emits a warning when ConfigService exists but no keys are declared', async () => {
      const fakeConfigService = {
        get: jest.fn(),
      }
      moduleRef.get.mockReturnValue(fakeConfigService)

      const result = await collector.execute({ source: 'config-service' })

      expect(result.data.warnings.some((w) => w.includes('NESTJS_MCP_CONFIG_KEYS'))).toBe(true)
    })
  })

  it('masks sensitive config keys and values from ConfigService', async () => {
    process.env.NESTJS_MCP_CONFIG_KEYS = 'database.host,database.password,callbackUrl'
    moduleRef.get.mockReturnValue({
      get: jest.fn((key: string) => {
        if (key === 'database.host') return 'localhost'
        if (key === 'database.password') return 'do-not-leak'
        if (key === 'callbackUrl') return 'Bearer abcdefghijklmnop'
        return undefined
      }),
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
    delete process.env.NESTJS_MCP_CONFIG_KEYS
  })

  it('serializes arrays, truncates long strings, and marks functions', async () => {
    const longValue = 'x'.repeat(1100)
    process.env.NESTJS_MCP_CONFIG_KEYS = 'list,longValue,handler'
    moduleRef.get.mockReturnValue({
      get: jest.fn((key: string) => {
        if (key === 'list') return ['a', 'b']
        if (key === 'longValue') return longValue
        if (key === 'handler') return () => 'unused'
        return undefined
      }),
    } as never)

    const result = await collector.execute({ source: 'config-service' })

    expect(entryByKey(result.data, 'list')).toMatchObject({ value: '["a","b"]' })
    expect(entryByKey(result.data, 'handler')).toMatchObject({ value: '[Function]' })

    const truncated = entryByKey(result.data, 'longValue').value
    expect(typeof truncated).toBe('string')
    expect((truncated as string).length).toBe(1027)
    expect(truncated).toMatch(/\.\.\.$/)
    delete process.env.NESTJS_MCP_CONFIG_KEYS
  })
})
