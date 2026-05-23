import { Injectable, Optional } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { CollectorResult, DevtoolsCollector } from './collector.interface'

type ConfigSource = 'env' | 'config-service'
type EntryStatus = 'set' | 'empty' | 'masked'
type SerializedValue = string | number | boolean | null
type ConstructableProvider = abstract new (...args: never[]) => unknown
type NestProviderToken = string | symbol | ConstructableProvider

interface ConfigEntry {
  source: ConfigSource
  key: string
  status: EntryStatus
  masked: boolean
  value: SerializedValue
  type: 'string' | 'number' | 'boolean' | 'object' | 'null' | 'undefined'
}

export interface ConfigCollectorData {
  entries: ConfigEntry[]
  total: number
  configServiceAvailable: boolean
  nodeEnv: string
  warnings: string[]
}

interface ConfigServiceLike {
  get?(key: string): unknown
}

interface ConfigCollectorParams {
  readonly source?: ConfigSource | 'configService' | 'all'
  readonly keyContains?: string
  readonly includeMasked?: boolean
}

const DESCRIPTION =
  'Dump current runtime configuration from process.env and @nestjs/config ConfigService. Sensitive values are auto-masked.'

const ENV_VALUE_WHITELIST = new Set(['NODE_ENV', 'PORT', 'HOST', 'TZ', 'LANG'])
const MASKED_VALUE = '***MASKED***'
const FUNCTION_VALUE = '[Function]'
const CIRCULAR_VALUE = '[Circular]'
const MAX_VALUE_LENGTH = 1024

const SENSITIVE_KEYWORDS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'privatekey',
  'credential',
  'credentials',
  'dsn',
  'connectionstring',
  'databaseurl',
  'auth',
  'authorization',
  'cookie',
  'session',
  'jwt',
  'cert',
  'certificate',
]

const SENSITIVE_VALUE_PATTERNS = [
  /^[A-Za-z0-9_-]{32,}$/,
  /postgres:\/\/|mysql:\/\/|mongodb:\/\//i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\b(?:sk|pk|rk|ghp|github_pat|xox[baprs])_[A-Za-z0-9_=-]{8,}\b/i,
]

@Injectable()
export class ConfigCollector implements DevtoolsCollector<ConfigCollectorData> {
  readonly toolName = 'get_config'
  readonly description = DESCRIPTION

  constructor(@Optional() private readonly moduleRef?: ModuleRef) {}

  async execute(params: Record<string, unknown>): Promise<CollectorResult<ConfigCollectorData>> {
    const filters = this.normalizeParams(params)
    const warnings: string[] = []

    const envEntries = this.shouldIncludeSource(filters, 'env') ? this.collectEnvEntries() : []
    const {
      available,
      entries: configEntries,
      warning,
    } = this.shouldIncludeSource(filters, 'config-service')
      ? this.collectConfigServiceEntries()
      : { available: false, entries: [] as ConfigEntry[], warning: undefined }

    if (warning) {
      warnings.push(warning)
    }

    const entries = [...envEntries, ...configEntries].filter((entry) => this.matchesFilters(entry, filters))

    return {
      toolName: this.toolName,
      data: {
        entries,
        total: entries.length,
        configServiceAvailable: available,
        nodeEnv: process.env.NODE_ENV || '',
        warnings,
      },
    }
  }

  private normalizeParams(params: Record<string, unknown>): ConfigCollectorParams {
    const source =
      params.source === 'env' ||
      params.source === 'config-service' ||
      params.source === 'configService' ||
      params.source === 'all'
        ? params.source
        : 'all'
    const keyContains = typeof params.keyContains === 'string' ? params.keyContains : undefined
    const includeMasked = typeof params.includeMasked === 'boolean' ? params.includeMasked : true

    return { source, keyContains, includeMasked }
  }

  private shouldIncludeSource(filters: ConfigCollectorParams, source: ConfigSource): boolean {
    return (
      filters.source === undefined ||
      filters.source === 'all' ||
      filters.source === source ||
      (filters.source === 'configService' && source === 'config-service')
    )
  }

  private matchesFilters(entry: ConfigEntry, filters: ConfigCollectorParams): boolean {
    if (filters.includeMasked === false && entry.masked) {
      return false
    }

    if (filters.keyContains && !entry.key.toLowerCase().includes(filters.keyContains.toLowerCase())) {
      return false
    }

    return true
  }

  private collectEnvEntries(): ConfigEntry[] {
    return Object.keys(process.env)
      .sort()
      .map((key) => this.createEnvEntry(key, process.env[key]))
  }

  private createEnvEntry(key: string, value: string | undefined): ConfigEntry {
    if (value === undefined || value === '') {
      return {
        source: 'env',
        key,
        status: 'empty',
        masked: false,
        value: null,
        type: value === undefined ? 'undefined' : 'string',
      }
    }

    if (this.shouldMask(key, value)) {
      return { source: 'env', key, status: 'masked', masked: true, value: MASKED_VALUE, type: 'string' }
    }

    if (ENV_VALUE_WHITELIST.has(key)) {
      return { source: 'env', key, status: 'set', masked: false, value, type: 'string' }
    }

    return { source: 'env', key, status: 'set', masked: false, value: null, type: 'undefined' }
  }

  private collectConfigServiceEntries(): { available: boolean; entries: ConfigEntry[]; warning?: string } {
    const configService = this.resolveConfigService()

    if (!configService) {
      return {
        available: false,
        entries: [],
        warning: 'ConfigService unavailable: @nestjs/config is not installed or ConfigModule is not registered.',
      }
    }

    if (typeof configService.get !== 'function') {
      return {
        available: false,
        entries: [],
        warning: 'ConfigService is available, but does not expose a get() method.',
      }
    }

    const keysStr = process.env.NESTJS_MCP_CONFIG_KEYS
    if (!keysStr || keysStr.trim() === '') {
      return {
        available: true,
        entries: [],
        warning: 'ConfigService is available, but no keys are declared in NESTJS_MCP_CONFIG_KEYS environment variable.',
      }
    }

    const keys = keysStr
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k !== '')

    const entries: ConfigEntry[] = []
    for (const key of keys) {
      try {
        const val = configService.get(key)
        entries.push(this.createConfigEntry(key, val))
      } catch (_err) {
        // Prevent single key error from failing the whole collection
      }
    }

    return {
      available: true,
      entries: entries.sort((a, b) => a.key.localeCompare(b.key)),
    }
  }

  private resolveConfigService(): ConfigServiceLike | undefined {
    if (!this.moduleRef) {
      return undefined
    }

    for (const token of this.getConfigServiceTokens()) {
      try {
        const resolved = this.moduleRef.get<ConfigServiceLike>(token, { strict: false })
        if (resolved) {
          return resolved
        }
      } catch {
        // ConfigService is optional; missing providers should never break the app.
      }
    }

    return undefined
  }

  private getConfigServiceTokens(): NestProviderToken[] {
    const tokens: NestProviderToken[] = ['ConfigService']

    try {
      const runtimeRequire = (0, eval)('require') as (moduleName: string) => unknown
      const configPackage = runtimeRequire('@nestjs/config') as { ConfigService?: ConstructableProvider }
      if (typeof configPackage.ConfigService === 'function') {
        tokens.unshift(configPackage.ConfigService)
      }
    } catch {
      // Avoid a hard dependency on @nestjs/config.
    }

    return tokens
  }

  private createConfigEntry(key: string, value: unknown): ConfigEntry {
    const serialized = this.serializeValue(value)
    const type = this.getValueType(value)

    if (value === undefined || serialized === '') {
      return { source: 'config-service', key, status: 'empty', masked: false, value: null, type }
    }

    if (this.shouldMask(key, serialized)) {
      return { source: 'config-service', key, status: 'masked', masked: true, value: MASKED_VALUE, type }
    }

    return {
      source: 'config-service',
      key,
      status: 'set',
      masked: false,
      value: serialized,
      type,
    }
  }

  private getValueType(value: unknown): ConfigEntry['type'] {
    if (value === undefined) {
      return 'undefined'
    }

    if (value === null) {
      return 'null'
    }

    if (typeof value === 'string') {
      return 'string'
    }

    if (typeof value === 'number') {
      return 'number'
    }

    if (typeof value === 'boolean') {
      return 'boolean'
    }

    return 'object'
  }

  private serializeValue(value: unknown): SerializedValue {
    if (typeof value === 'function') {
      return FUNCTION_VALUE
    }

    if (value === undefined) {
      return ''
    }

    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return this.truncateStringValue(value)
    }

    return this.stringifyObject(value)
  }

  private stringifyObject(value: unknown): string {
    const seen = new WeakSet<object>()

    try {
      const serialized = JSON.stringify(value, (_key, childValue: unknown) => {
        if (typeof childValue === 'function') {
          return FUNCTION_VALUE
        }

        if (typeof childValue === 'object' && childValue !== null) {
          if (seen.has(childValue)) {
            return CIRCULAR_VALUE
          }
          seen.add(childValue)
        }

        return childValue
      })

      return this.truncateStringValue(serialized ?? '')
    } catch {
      return CIRCULAR_VALUE
    }
  }

  private truncateStringValue<T extends SerializedValue>(value: T): T | string {
    if (typeof value !== 'string' || value.length <= MAX_VALUE_LENGTH) {
      return value
    }

    return `${value.slice(0, MAX_VALUE_LENGTH)}...`
  }

  private shouldMask(key: string, value: unknown): boolean {
    if (this.isSensitiveKey(key)) {
      return true
    }

    if (typeof value !== 'string') {
      return false
    }

    return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value))
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
    return SENSITIVE_KEYWORDS.some((keyword) => normalized.includes(keyword))
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
      return false
    }

    if (Array.isArray(value)) {
      return false
    }

    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }
}
