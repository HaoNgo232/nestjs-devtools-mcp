import { Inject, Injectable, NestMiddleware } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options'
import { REQUEST_HISTORY_RECORDED } from './request-history.constants'
import { RequestHistoryBufferService, RequestHistoryError } from './request-history-buffer.service'
import { RequestContextService } from './request-context.service'

interface HeaderBag {
  [key: string]: string | string[] | number | undefined
}

interface HttpRequestLike {
  [REQUEST_HISTORY_RECORDED]?: boolean
  method?: string
  originalUrl?: string
  url?: string
  path?: string
  ip?: string
  headers?: HeaderBag
  socket?: { remoteAddress?: string }
  connection?: { remoteAddress?: string }
  requestId?: string
}

interface HttpResponseLike {
  statusCode?: number
  writableEnded?: boolean
  once?: (event: string, listener: () => void) => unknown
  getHeader?: (name: string) => number | string | string[] | undefined
}

type NextFunctionLike = () => void

@Injectable()
export class RequestHistoryMiddleware implements NestMiddleware {
  constructor(
    private readonly buffer: RequestHistoryBufferService,
    @Inject(DEVTOOLS_OPTIONS_TOKEN)
    private readonly options: DevtoolsMcpOptions,
    private readonly contextService: RequestContextService,
  ) {}

  use(request: HttpRequestLike, response: HttpResponseLike, next: NextFunctionLike): void {
    if (this.isDevtoolsRequest(request)) {
      next()
      return
    }

    const requestId = request.requestId || randomUUID()
    request.requestId = requestId

    const startedAt = Date.now()
    let recorded = false

    const record = (statusCode: number, error: RequestHistoryError | null) => {
      if (recorded || request[REQUEST_HISTORY_RECORDED]) {
        return
      }

      recorded = true
      request[REQUEST_HISTORY_RECORDED] = true

      try {
        this.buffer.add({
          method: this.getMethod(request),
          path: this.getPath(request),
          routePattern: null,
          statusCode,
          durationMs: Date.now() - startedAt,
          controllerName: null,
          handlerName: null,
          ip: this.getIp(request),
          userAgent: this.getHeaderValue(request, 'user-agent'),
          requestSize: this.getContentLength(request),
          responseSize: this.getResponseSize(response),
          error,
          requestId,
        })
      } catch {
        // Middleware fallback must never affect the host application's behavior.
      }
    }

    response.once?.('finish', () => {
      const statusCode = this.getStatusCode(response)
      record(statusCode, this.createHttpError(statusCode))
    })

    response.once?.('close', () => {
      if (!this.isResponseFinished(response)) {
        record(0, {
          name: 'ClientAborted',
          message: 'Client disconnected before response completed',
          stack: null,
        })
      }
    })

    this.contextService.run(requestId, () => {
      next()
    })
  }

  private isDevtoolsRequest(request: HttpRequestLike): boolean {
    const path = this.getPath(request)
    const endpoint = this.normalizeEndpoint(this.options.endpoint || '/_dev/mcp')
    return path === endpoint || path.startsWith(`${endpoint}/`) || path === '/_dev/mcp' || path.startsWith('/_dev/mcp/')
  }

  private normalizeEndpoint(endpoint: string): string {
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return normalized.replace(/\/+$/, '')
  }

  private getMethod(request: HttpRequestLike): string {
    return (request.method || 'UNKNOWN').toUpperCase()
  }

  private getPath(request: HttpRequestLike): string {
    const rawPath = request.originalUrl || request.url || request.path || ''
    const pathWithoutQuery = rawPath.split('?')[0] || '/'
    return pathWithoutQuery.startsWith('/') ? pathWithoutQuery : `/${pathWithoutQuery}`
  }

  private getIp(request: HttpRequestLike): string {
    return request.ip || request.socket?.remoteAddress || request.connection?.remoteAddress || ''
  }

  private getHeaderValue(request: HttpRequestLike, name: string): string | null {
    const headers = request.headers || {}
    const value = headers[name] ?? headers[name.toLowerCase()]

    if (Array.isArray(value)) {
      return value.join(', ')
    }

    if (typeof value === 'number') {
      return String(value)
    }

    return typeof value === 'string' ? value : null
  }

  private getContentLength(request: HttpRequestLike): number | null {
    return this.parseContentLength(this.getHeaderValue(request, 'content-length'))
  }

  private getResponseSize(response: HttpResponseLike): number | null {
    const contentType = response.getHeader?.('content-type')
    const contentTypeText = Array.isArray(contentType) ? contentType.join(',') : String(contentType || '')

    if (/text\/event-stream|application\/octet-stream/i.test(contentTypeText)) {
      return null
    }

    const value = response.getHeader?.('content-length')
    const header = Array.isArray(value) ? value[0] : value
    return this.parseContentLength(typeof header === 'number' ? String(header) : header)
  }

  private parseContentLength(value: string | null | undefined): number | null {
    if (typeof value !== 'string' || value.trim() === '') {
      return null
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }

  private getStatusCode(response: HttpResponseLike): number {
    return typeof response.statusCode === 'number' ? response.statusCode : 200
  }

  private createHttpError(statusCode: number): RequestHistoryError | null {
    if (statusCode < 400) {
      return null
    }

    return {
      name: 'HttpError',
      message: `HTTP ${statusCode}`,
      stack: null,
    }
  }

  private isResponseFinished(response: HttpResponseLike): boolean {
    return response.writableEnded === true
  }
}
