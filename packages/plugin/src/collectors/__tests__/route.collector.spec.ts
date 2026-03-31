import { Test, TestingModule } from '@nestjs/testing'
import { DiscoveryService, Reflector } from '@nestjs/core'
import { RouteCollector } from '../route.collector'
import { RequestMethod, Get } from '@nestjs/common'
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants'

/**
 * Unit tests for RouteCollector — the DevtoolsCollector for 'get_routes' tool.
 * Validates route discovery, metadata extraction, and internal route filtering.
 */
describe('RouteCollector', () => {
  let collector: RouteCollector
  let mockDiscoveryService: jest.Mocked<Pick<DiscoveryService, 'getControllers'>>
  let mockReflector: jest.Mocked<Pick<Reflector, 'get'>>

  // ── Helper: build a mock controller wrapper ───────────────

  function createControllerWrapper(
    controllerClass: new (...args: any[]) => any,
    instance: Record<string, unknown> = {},
  ): any {
    return {
      metatype: controllerClass,
      instance,
      name: controllerClass.name,
      token: controllerClass,
      host: undefined,
      isResolved: true,
    }
  }

  // ── Helper: create a controller class with metadata ───────

  function createMockController(
    name: string,
    basePath: string,
    handlers: Array<{ handlerName: string; method: RequestMethod; path: string }>,
  ) {
    // Dynamically create a class with the given name
    // Tạo class động theo tên (Tên controller hiển thị trong kết quả)
    const container = { [name]: class {} }
    const Controller = (container as any)[name]

    // Set controller-level PATH_METADATA
    Reflect.defineMetadata(PATH_METADATA, basePath, Controller)

    // Set method-level metadata on prototype
    for (const h of handlers) {
      // Create a method on the prototype
      Object.defineProperty(Controller.prototype, h.handlerName, {
        value: () => undefined,
        writable: true,
        enumerable: false,
        configurable: true,
      })

      const handler = (Controller.prototype as any)[h.handlerName]
      Reflect.defineMetadata(PATH_METADATA, h.path, handler)
      Reflect.defineMetadata(METHOD_METADATA, h.method, handler)
    }

    return Controller as new (...args: any[]) => any
  }

  beforeEach(() => {
    mockDiscoveryService = {
      getControllers: jest.fn().mockReturnValue([]),
    }

    mockReflector = {
      get: jest.fn().mockReturnValue(undefined),
    }

    collector = new RouteCollector(
      mockDiscoveryService as unknown as DiscoveryService,
      mockReflector as unknown as Reflector,
    )
  })

  // ── Identity ──────────────────────────────────────────────

  it('should expose toolName as "get_routes"', () => {
    expect(collector.toolName).toBe('get_routes')
  })

  it('should expose a non-empty description', () => {
    expect(collector.description).toBeTruthy()
    expect(typeof collector.description).toBe('string')
  })

  // ── Empty state ───────────────────────────────────────────

  it('should return empty routes array when no controllers are registered', async () => {
    mockDiscoveryService.getControllers.mockReturnValue([])

    const result = await collector.execute({})

    expect(result.toolName).toBe('get_routes')
    expect(result.data).toEqual({
      routes: [],
      total: 0,
    })
  })

  // ── Single controller with multiple methods ───────────────

  it('should discover routes from a controller with multiple handlers', async () => {
    const UserController = createMockController('UserController', '/users', [
      { handlerName: 'findAll', method: RequestMethod.GET, path: '/' },
      { handlerName: 'create', method: RequestMethod.POST, path: '/' },
    ])

    mockDiscoveryService.getControllers.mockReturnValue([createControllerWrapper(UserController)] as any)

    // Re-create collector that reads metadata directly (not through mocked reflector)
    const realReflector = new Reflector()
    collector = new RouteCollector(mockDiscoveryService as unknown as DiscoveryService, realReflector)

    const result = await collector.execute({})

    expect(result.toolName).toBe('get_routes')
    expect(result.data.total).toBe(2)
    expect(result.data.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'GET',
          path: '/users/',
          controllerName: 'UserController',
          handlerName: 'findAll',
        }),
        expect.objectContaining({
          method: 'POST',
          path: '/users/',
          controllerName: 'UserController',
          handlerName: 'create',
        }),
      ]),
    )
  })

  // ── Multiple controllers ──────────────────────────────────

  it('should discover routes from multiple controllers', async () => {
    const UserController = createMockController('UserController', '/users', [
      { handlerName: 'findAll', method: RequestMethod.GET, path: '/' },
    ])

    const ProductController = createMockController('ProductController', '/products', [
      { handlerName: 'getById', method: RequestMethod.GET, path: '/:id' },
      { handlerName: 'remove', method: RequestMethod.DELETE, path: '/:id' },
    ])

    mockDiscoveryService.getControllers.mockReturnValue([
      createControllerWrapper(UserController),
      createControllerWrapper(ProductController),
    ] as any)

    const realReflector = new Reflector()
    collector = new RouteCollector(mockDiscoveryService as unknown as DiscoveryService, realReflector)

    const result = await collector.execute({})

    expect(result.data.total).toBe(3)
    expect(result.data.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'GET', path: '/users/', controllerName: 'UserController' }),
        expect.objectContaining({ method: 'GET', path: '/products/:id', controllerName: 'ProductController' }),
        expect.objectContaining({ method: 'DELETE', path: '/products/:id', controllerName: 'ProductController' }),
      ]),
    )
  })

  // ── Internal route filtering ──────────────────────────────

  it('should EXCLUDE internal /_dev/mcp/* routes from output', async () => {
    const DevtoolsController = createMockController('DevtoolsMcpController', '_dev/mcp', [
      { handlerName: 'getHealth', method: RequestMethod.GET, path: 'health' },
      { handlerName: 'handleTool', method: RequestMethod.POST, path: 'tools/:toolName' },
    ])

    const UserController = createMockController('UserController', '/users', [
      { handlerName: 'findAll', method: RequestMethod.GET, path: '/' },
    ])

    mockDiscoveryService.getControllers.mockReturnValue([
      createControllerWrapper(DevtoolsController),
      createControllerWrapper(UserController),
    ] as any)

    const realReflector = new Reflector()
    collector = new RouteCollector(mockDiscoveryService as unknown as DiscoveryService, realReflector)

    const result = await collector.execute({})

    // Only UserController route should appear
    expect(result.data.total).toBe(1)
    expect(result.data.routes[0]).toMatchObject({
      method: 'GET',
      path: '/users/',
      controllerName: 'UserController',
    })

    // No _dev/mcp routes
    const devRoutes = result.data.routes.filter((r) => r.path.includes('_dev/mcp'))
    expect(devRoutes).toHaveLength(0)
  })

  // ── HTTP method mapping ───────────────────────────────────

  it('should correctly map all RequestMethod enum values to string names', async () => {
    const AllMethodsController = createMockController('AllMethodsController', '/test', [
      { handlerName: 'handleGet', method: RequestMethod.GET, path: '/get' },
      { handlerName: 'handlePost', method: RequestMethod.POST, path: '/post' },
      { handlerName: 'handlePut', method: RequestMethod.PUT, path: '/put' },
      { handlerName: 'handleDelete', method: RequestMethod.DELETE, path: '/delete' },
      { handlerName: 'handlePatch', method: RequestMethod.PATCH, path: '/patch' },
      { handlerName: 'handleOptions', method: RequestMethod.OPTIONS, path: '/options' },
      { handlerName: 'handleHead', method: RequestMethod.HEAD, path: '/head' },
      { handlerName: 'handleAll', method: RequestMethod.ALL, path: '/all' },
    ])

    mockDiscoveryService.getControllers.mockReturnValue([createControllerWrapper(AllMethodsController)] as any)

    const realReflector = new Reflector()
    collector = new RouteCollector(mockDiscoveryService as unknown as DiscoveryService, realReflector)

    const result = await collector.execute({})

    const methods = result.data.routes.map((r) => r.method).sort()
    expect(methods).toEqual(['ALL', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'])
  })

  // ── Controller without any route handlers ─────────────────

  it('should handle controllers that have no decorated handler methods', async () => {
    // A plain class with no methods decorated with @Get/@Post/etc.
    class EmptyController {}
    Reflect.defineMetadata(PATH_METADATA, '/empty', EmptyController)

    mockDiscoveryService.getControllers.mockReturnValue([createControllerWrapper(EmptyController)] as any)

    const realReflector = new Reflector()
    collector = new RouteCollector(mockDiscoveryService as unknown as DiscoveryService, realReflector)

    const result = await collector.execute({})

    expect(result.data.routes).toEqual([])
    expect(result.data.total).toBe(0)
  })

  // ── CollectorResult shape conformance ─────────────────────

  it('should return CollectorResult with correct toolName regardless of content', async () => {
    mockDiscoveryService.getControllers.mockReturnValue([])

    const result = await collector.execute({})

    expect(result).toHaveProperty('toolName', 'get_routes')
    expect(result).toHaveProperty('data')
    expect(result.data).toHaveProperty('routes')
    expect(result.data).toHaveProperty('total')
  })

  // ── Edge Case coverage ────────────────────────────────────

  it('should skip controllers without metatype', async () => {
    mockDiscoveryService.getControllers.mockReturnValue([{ metatype: null }] as any)

    const result = await collector.execute({})
    expect(result.data.routes).toHaveLength(0)
  })

  it('should skip controllers without PATH_METADATA', async () => {
    class NoMetaController {}
    mockDiscoveryService.getControllers.mockReturnValue([createControllerWrapper(NoMetaController)] as any)

    const result = await collector.execute({})
    expect(result.data.routes).toHaveLength(0)
  })

  it('should skip prototype methods without METHOD_METADATA', async () => {
    class MixedController {
      @Get('/')
      find() {}

      notHandler() {}
    }
    Reflect.defineMetadata(PATH_METADATA, '/mixed', MixedController)
    // find() will have METHOD_METADATA, notHandler() won't.

    mockDiscoveryService.getControllers.mockReturnValue([createControllerWrapper(MixedController)] as any)

    const realReflector = new Reflector()
    collector = new RouteCollector(mockDiscoveryService as unknown as DiscoveryService, realReflector)

    const result = await collector.execute({})
    expect(result.data.total).toBe(1)
    expect(result.data.routes[0].handlerName).toBe('find')
  })

  it('should handle controllers without names and paths without leading slashes', async () => {
    const NoNameController = class {}
    Reflect.defineMetadata(PATH_METADATA, 'no-slash', NoNameController)
    Object.defineProperty(NoNameController, 'name', { value: '' }) // Empty name

    Object.defineProperty(NoNameController.prototype, 'handle', {
      value: () => undefined,
      writable: true,
    })
    const handler = (NoNameController.prototype as any).handle
    Reflect.defineMetadata(PATH_METADATA, 'sub', handler)
    Reflect.defineMetadata(METHOD_METADATA, RequestMethod.GET, handler)

    mockDiscoveryService.getControllers.mockReturnValue([createControllerWrapper(NoNameController)] as any)

    const realReflector = new Reflector()
    collector = new RouteCollector(mockDiscoveryService as unknown as DiscoveryService, realReflector)

    const result = await collector.execute({})
    expect(result.data.routes[0]).toMatchObject({
      controllerName: 'UnknownController',
      path: '/no-slash/sub',
    })
  })

  it('should handle unknown RequestMethod values', async () => {
    const UnknownController = class {}
    Reflect.defineMetadata(PATH_METADATA, '/test', UnknownController)
    Object.defineProperty(UnknownController.prototype, 'act', { value: () => 1 })
    const handler = (UnknownController.prototype as any).act
    Reflect.defineMetadata(PATH_METADATA, '/', handler)
    Reflect.defineMetadata(METHOD_METADATA, 999, handler) // Unknown method

    mockDiscoveryService.getControllers.mockReturnValue([createControllerWrapper(UnknownController)] as any)

    const realReflector = new Reflector()
    collector = new RouteCollector(mockDiscoveryService as unknown as DiscoveryService, realReflector)

    const result = await collector.execute({})
    expect(result.data.routes[0].method).toBe('UNKNOWN(999)')
  })

  it('should handle handlers with METHOD_METADATA but missing PATH_METADATA', async () => {
    const NoPathController = class {}
    Reflect.defineMetadata(PATH_METADATA, '/test', NoPathController)
    Object.defineProperty(NoPathController.prototype, 'act', { value: () => 1 })
    const handler = (NoPathController.prototype as any).act
    // NO PATH_METADATA here - Không có metadata đường dẫn
    Reflect.defineMetadata(METHOD_METADATA, RequestMethod.GET, handler)

    mockDiscoveryService.getControllers.mockReturnValue([createControllerWrapper(NoPathController)] as any)

    const realReflector = new Reflector()
    collector = new RouteCollector(mockDiscoveryService as unknown as DiscoveryService, realReflector)

    const result = await collector.execute({})
    expect(result.data.routes[0].path).toBe('/test/') // Should use empty string as fallback - Fallback về chuỗi rỗng
  })
})
