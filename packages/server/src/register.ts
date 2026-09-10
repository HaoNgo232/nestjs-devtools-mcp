/* eslint-disable @typescript-eslint/no-require-imports */
import Module from 'module'

let isPatched = false

interface NestFactoryLike {
  create: (rootModule: unknown, options?: Record<string, unknown>) => Promise<unknown>
  __mcp_zero_code_patched?: boolean
  constructor?: {
    prototype?: {
      create?: (rootModule: unknown, options?: Record<string, unknown>) => Promise<unknown>
    }
  }
}

interface PluginModuleLike {
  DevtoolsMcpModule?: {
    register: () => unknown
  }
}

interface ReflectWithMetadata {
  getMetadata?: (metadataKey: unknown, target: unknown) => unknown[] | undefined
  defineMetadata?: (metadataKey: unknown, metadataValue: unknown, target: unknown) => void
}

/**
 * Safely resolves and loads the DevtoolsMcpModule from @nestjs-devtools-mcp/plugin.
 */
export function getPluginModule(): PluginModuleLike | null {
  try {
    return require('@nestjs-devtools-mcp/plugin') as PluginModuleLike
  } catch (_err) {
    try {
      const resolved = require.resolve('@nestjs-devtools-mcp/plugin', {
        paths: [__dirname, process.cwd()],
      })
      return require(resolved) as PluginModuleLike
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(
        '[NestJS DevTools MCP] Failed to resolve @nestjs-devtools-mcp/plugin. ' +
          'Ensure nestjs-devtools-mcp is installed.',
        msg,
      )
      return null
    }
  }
}

/**
 * Patches NestFactory to automatically inject DevtoolsMcpModule into the root module.
 */
export function patchNestFactory(nestFactory: unknown): void {
  const target = nestFactory as NestFactoryLike | undefined
  if (!target || target.__mcp_zero_code_patched) {
    return
  }

  const originalCreate = target.create
  if (typeof originalCreate !== 'function') {
    return
  }

  target.__mcp_zero_code_patched = true

  target.create = async function (rootModule: unknown, options: Record<string, unknown> = {}) {
    try {
      // 1. Skip injection if running in production mode
      if (process.env.NODE_ENV === 'production') {
        return await originalCreate.call(this, rootModule, options)
      }

      // 2. Ensure bufferLogs is enabled so DevTools logger captures startup logs
      if (typeof options === 'object' && options !== null) {
        options.bufferLogs = true
      }

      // 3. Inject DevtoolsMcpModule into rootModule imports metadata
      const reflectAny = typeof Reflect !== 'undefined' ? (Reflect as unknown as ReflectWithMetadata) : undefined
      if (rootModule && reflectAny && typeof reflectAny.getMetadata === 'function') {
        const plugin = getPluginModule()
        const DevtoolsMcpModule = plugin?.DevtoolsMcpModule

        if (DevtoolsMcpModule) {
          const currentImports = reflectAny.getMetadata('imports', rootModule) || []
          const isAlreadyImported = currentImports.some((imp: unknown) => {
            if (imp === DevtoolsMcpModule) return true
            if (
              imp &&
              typeof imp === 'object' &&
              'module' in imp &&
              (imp as { module: unknown }).module === DevtoolsMcpModule
            ) {
              return true
            }
            return false
          })

          if (!isAlreadyImported && typeof reflectAny.defineMetadata === 'function') {
            reflectAny.defineMetadata('imports', [...currentImports, DevtoolsMcpModule.register()], rootModule)
            console.error('\x1b[32m[NestJS DevTools MCP]\x1b[0m Zero-code preload active: DevtoolsMcpModule injected.')
          }
        }
      }
    } catch (err) {
      console.error('[NestJS DevTools MCP] Preload hook error (falling back to standard bootstrap):', err)
    }

    return await originalCreate.call(this, rootModule, options)
  }

  // Also patch the constructor prototype if available
  if (target.constructor && target.constructor.prototype) {
    target.constructor.prototype.create = target.create
  }
}

/**
 * Install the Module.prototype.require interceptor to catch @nestjs/core as soon as it is loaded.
 */
export function initRegister(): void {
  if (isPatched) {
    return
  }
  isPatched = true

  const moduleProto = Module.prototype as unknown as {
    require: (id: string, ...rest: unknown[]) => unknown
  }
  const originalRequire = moduleProto.require

  moduleProto.require = function (id: string, ...rest: unknown[]) {
    const exports = originalRequire.apply(this, [id, ...rest]) as Record<string, unknown> | undefined

    if (
      id === '@nestjs/core' ||
      (typeof id === 'string' && (id.endsWith('/@nestjs/core/index.js') || id.endsWith('/@nestjs/core/index')))
    ) {
      if (exports && exports.NestFactory) {
        patchNestFactory(exports.NestFactory)
      }
    }

    return exports
  }

  // Check if @nestjs/core is already in require.cache
  try {
    for (const key of Object.keys(require.cache)) {
      if (key.includes('@nestjs/core')) {
        const cached = require.cache[key]
        if (cached && cached.exports && typeof cached.exports === 'object' && 'NestFactory' in cached.exports) {
          patchNestFactory((cached.exports as { NestFactory: unknown }).NestFactory)
        }
      }
    }
  } catch (_e) {
    // Fail-safe
  }
}

// Auto-run when required via Node's -r / --require flag
initRegister()
