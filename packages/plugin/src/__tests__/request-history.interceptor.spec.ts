import { ExecutionContext } from '@nestjs/common'
import { PATH_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { EventEmitter } from 'events'
import { lastValueFrom, NEVER, of, throwError } from 'rxjs'
import { RequestHistoryBufferService } from '../request-history-buffer.service'
import { RequestHistoryInterceptor } from '../request-history.interceptor'

class MockResponse extends EventEmitter {
  statusCode = 200
  writableEnded = false
  private readonly headers = new Map<string, string | number>()

  once(event: string, listener: () => void): this {
    return super.once(event, listener)
  }

  getHeader(name: string) {
    return this.headers.get(name.toLowerCase())
  }

  setHeader(name: string, value: string | number) {
    this.headers.set(name.toLowerCase(), value)
  }

  finish() {
    this.writableEnded = true
    this.emit('finish')
  }

  closeBeforeFinish() {
    this.writableEnded = false
    this.emit('close')
  }
}

describe('RequestHistoryInterceptor', () => {
  let buffer: jest.Mocked<Pick<RequestHistoryBufferService, 'add'>>
  let contextService: any
  let interceptor: RequestHistoryInterceptor
  let response: MockResponse

  function handler() {
    return undefined
  }

  class UsersController {}

  const createContext = (overrides: Record<string, unknown> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/users/42?include=posts',
          ip: '127.0.0.1',
          headers: {
            'user-agent': 'jest-agent',
            'content-length': '123',
          },
          ...overrides,
        }),
        getResponse: () => response,
      }),
      getClass: () => UsersController,
      getHandler: () => handler,
    }) as unknown as ExecutionContext

  beforeEach(() => {
    Reflect.defineMetadata(PATH_METADATA, 'users', UsersController)
    Reflect.defineMetadata(PATH_METADATA, ':id', handler)

    response = new MockResponse()
    response.setHeader('content-length', '456')

    buffer = {
      add: jest.fn(),
    }
    contextService = {
      run: jest.fn((id, cb) => cb()),
      getRequestId: jest.fn().mockReturnValue('mock-id'),
    }

    interceptor = new RequestHistoryInterceptor(
      buffer as unknown as RequestHistoryBufferService,
      new Reflector(),
      { endpoint: '/_dev/mcp' },
      contextService,
    )
  })

  it('records successful requests after the response finishes with requestId', async () => {
    const request: any = {
      method: 'GET',
      originalUrl: '/users/42?include=posts',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'jest-agent',
        'content-length': '123',
      },
      requestId: 'custom-req-id',
    }
    const result = await lastValueFrom(
      interceptor.intercept(
        {
          switchToHttp: () => ({
            getRequest: () => request,
            getResponse: () => response,
          }),
          getClass: () => UsersController,
          getHandler: () => handler,
        } as any,
        { handle: () => of('ok') },
      ),
    )
    response.finish()

    expect(result).toBe('ok')
    expect(contextService.run).toHaveBeenCalledWith('custom-req-id', expect.any(Function))
    expect(buffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/users/42',
        routePattern: '/users/:id',
        statusCode: 200,
        controllerName: 'UsersController',
        handlerName: 'handler',
        ip: '127.0.0.1',
        userAgent: 'jest-agent',
        requestSize: 123,
        responseSize: 456,
        error: null,
        requestId: 'custom-req-id',
      }),
    )
  })

  it('records exceptions and returns status code', async () => {
    const error = new Error('Database Error')
    const flow = interceptor.intercept(createContext(), {
      handle: () => throwError(() => error),
    })

    await expect(lastValueFrom(flow)).rejects.toThrow(error)
    response.finish()

    expect(buffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: expect.objectContaining({
          name: 'Error',
          message: 'Database Error',
        }),
      }),
    )
  })

  it('records client-aborted requests with statusCode 0', () => {
    const subscription = interceptor.intercept(createContext(), { handle: () => NEVER }).subscribe()

    response.closeBeforeFinish()
    subscription.unsubscribe()

    expect(buffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 0,
        error: {
          name: 'ClientAborted',
          message: 'Client disconnected before response completed',
          stack: null,
        },
      }),
    )
  })

  it('does not expose shouldCaptureRequestBody method', () => {
    expect((interceptor as any).shouldCaptureRequestBody).toBeUndefined()
  })
})
