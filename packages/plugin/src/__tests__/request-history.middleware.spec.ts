import { EventEmitter } from 'events'
import { RequestHistoryMiddleware } from '../request-history.middleware'
import { REQUEST_HISTORY_RECORDED } from '../request-history.constants'
import { RequestHistoryBufferService } from '../request-history-buffer.service'

describe('RequestHistoryMiddleware', () => {
  let add: jest.Mock
  let contextService: any
  let middleware: RequestHistoryMiddleware

  function createResponse(statusCode = 200, headers: Record<string, string> = {}) {
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number
      writableEnded: boolean
      getHeader: (name: string) => string | undefined
    }

    response.statusCode = statusCode
    response.writableEnded = true
    response.getHeader = (name: string) => headers[name.toLowerCase()]

    return response
  }

  beforeEach(() => {
    add = jest.fn()
    contextService = {
      run: jest.fn((id, cb) => cb()),
      getRequestId: jest.fn().mockReturnValue('mock-id'),
    }
    middleware = new RequestHistoryMiddleware(
      { add } as unknown as RequestHistoryBufferService,
      { endpoint: '/_dev/mcp' },
      contextService,
    )
  })

  it('records unmatched requests after response finish with requestId', () => {
    const request: any = {
      method: 'GET',
      originalUrl: '/missing?debug=true',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'jest',
      },
    }
    const response = createResponse(404, { 'content-length': '82' })
    const next = jest.fn()

    middleware.use(request, response, next)
    response.emit('finish')

    expect(next).toHaveBeenCalled()
    expect(contextService.run).toHaveBeenCalledWith(expect.any(String), expect.any(Function))
    expect(request.requestId).toBeDefined()
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/missing',
        routePattern: null,
        statusCode: 404,
        controllerName: null,
        handlerName: null,
        responseSize: 82,
        error: { name: 'HttpError', message: 'HTTP 404', stack: null },
        requestId: request.requestId,
      }),
    )
  })

  it('does not duplicate requests already handled by the interceptor', () => {
    const request = {
      [REQUEST_HISTORY_RECORDED]: true,
      method: 'GET',
      originalUrl: '/users/1',
      headers: {},
    }
    const response = createResponse(200)

    middleware.use(request, response, jest.fn())
    response.emit('finish')

    expect(add).not.toHaveBeenCalled()
  })

  it('skips internal devtools requests', () => {
    const request = {
      method: 'POST',
      originalUrl: '/_dev/mcp/tools/get_request_history',
      headers: {},
    }
    const response = createResponse(200)

    middleware.use(request, response, jest.fn())
    response.emit('finish')

    expect(add).not.toHaveBeenCalled()
  })
})
