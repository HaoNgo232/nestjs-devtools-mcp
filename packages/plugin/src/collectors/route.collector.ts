import { Injectable } from '@nestjs/common'
import { DiscoveryService, Reflector } from '@nestjs/core'
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants'
import { RequestMethod } from '@nestjs/common'
import { DevtoolsCollector, CollectorResult } from './collector.interface'

/**
 * Information about a single registered HTTP route.
 */
export interface RouteInfo {
  method: string
  path: string
  controllerName: string
  handlerName: string
}

/**
 * Map from NestJS RequestMethod enum to human-readable HTTP method strings.
 */
const REQUEST_METHOD_MAP: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
  [RequestMethod.ALL]: 'ALL',
}

/**
 * RouteCollector implements DevtoolsCollector to handle 'get_routes' tool requests.
 * It uses NestJS DiscoveryService to enumerate all registered controllers and their
 * handler methods, extracting route metadata (method, path, controller name, handler name).
 *
 * Internal DevTools routes (/_dev/mcp/*) are excluded from the output.
 */
@Injectable()
export class RouteCollector implements DevtoolsCollector<{ routes: RouteInfo[]; total: number }> {
  readonly toolName = 'get_routes'
  readonly description = 'List all registered HTTP routes in the NestJS application with their methods and paths.'

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Executes route discovery and returns all registered HTTP routes.
   */
  async execute(_params: Record<string, unknown>): Promise<CollectorResult<{ routes: RouteInfo[]; total: number }>> {
    const routes: RouteInfo[] = []
    const controllers = this.discoveryService.getControllers()

    for (const wrapper of controllers) {
      const { metatype } = wrapper

      // Skip controllers without a class reference
      if (!metatype) {
        continue
      }

      // Get controller-level base path
      const controllerPath: string | undefined = this.reflector.get<string>(PATH_METADATA, metatype)

      // If no PATH_METADATA, this isn't a proper @Controller — skip
      if (controllerPath === undefined) {
        continue
      }

      const controllerName = metatype.name || 'UnknownController'

      // Filter out internal DevTools routes early at controller level
      const normalizedControllerPath = controllerPath.replace(/^\/+/, '')
      if (normalizedControllerPath.startsWith('_dev/mcp')) {
        continue
      }

      // Enumerate all methods on the controller prototype
      const prototype = metatype.prototype as Record<string, unknown>
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) => name !== 'constructor' && typeof prototype[name] === 'function',
      )

      for (const handlerName of methodNames) {
        const handler = prototype[handlerName] as (...args: unknown[]) => unknown

        // Read handler-level metadata
        const methodEnum: RequestMethod | undefined = this.reflector.get<RequestMethod>(METHOD_METADATA, handler)

        // If no METHOD_METADATA, this method isn't a route handler — skip
        if (methodEnum === undefined) {
          continue
        }

        const handlerPath: string = this.reflector.get<string>(PATH_METADATA, handler) ?? ''

        // Build the full path
        const basePath = controllerPath.startsWith('/') ? controllerPath : `/${controllerPath}`
        const fullPath = `${basePath}${handlerPath.startsWith('/') ? handlerPath : `/${handlerPath}`}`.replace(
          /\/+/g,
          '/',
        )

        // Map RequestMethod enum to string
        const methodString = REQUEST_METHOD_MAP[methodEnum] ?? `UNKNOWN(${methodEnum})`

        routes.push({
          method: methodString,
          path: fullPath,
          controllerName,
          handlerName,
        })
      }
    }

    return {
      toolName: this.toolName,
      data: {
        routes,
        total: routes.length,
      },
    }
  }
}
