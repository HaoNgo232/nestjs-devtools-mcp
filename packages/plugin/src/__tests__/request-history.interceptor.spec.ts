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

    interceptor = new RequestHistoryInterceptor(
      buffer as unknown as RequestHistoryBufferService,
      new Reflector(),
      { endpoint: '/_dev/mcp' },
    )
  })

  it('records successful requests after the response finishes', async () => {
    const result = await lastValueFrom(interceptor.intercept(createContext(), { handle: () => of('ok') }))
    response.finish()

    expect(result).toBe('ok')
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
      }),
    )
  })

  it('records thrown errors and rethrows them unchanged', async () => {
    const error = new Error('boom')

    await expect(lastValueFrom(interceptor.intercept(createContext(), { handle: () => throwError(() => error) }))).rejects.toBe(
      error,
    )

    expect(buffer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: expect.objectContaining({ name: 'Error', message: 'boom' }),
      }),
    )
  })

  it('does not record internal devtools endpoint requests', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(createContext({ originalUrl: '/_dev/mcp/tools/get_logs' }), { handle: () => of('ok') }),
    )
    response.finish()

    expect(result).toBe('ok')
    expect(buffer.add).not.toHaveBeenCalled()
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

  it('does not capture multipart request bodies even if body capture is later enabled', () => {
    const captureEnabled = new RequestHistoryInterceptor(
      buffer as unknown as RequestHistoryBufferService,
      new Reflector(),
      { endpoint: '/_dev/mcp', captureRequestBody: true } as any,
    )

    const canCapture = (captureEnabled as any).shouldCaptureRequestBody({
      headers: { 'content-type': 'multipart/form-data; boundary=abc' },
    })

    expect(canCapture).toBe(false)
  })
})
