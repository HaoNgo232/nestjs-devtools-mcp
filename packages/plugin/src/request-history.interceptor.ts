import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common'
import { PATH_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { Observable, throwError } from 'rxjs'
import { catchError, finalize } from 'rxjs/operators'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options'
import { REQUEST_HISTORY_RECORDED } from './request-history.constants'
import { RequestHistoryBufferService, RequestHistoryError } from './request-history-buffer.service'

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
}

interface HttpResponseLike {
  statusCode?: number
  writableEnded?: boolean
  headersSent?: boolean
  once?: (event: string, listener: () => void) => unknown
  getHeader?: (name: string) => number | string | string[] | undefined
}

@Injectable()
export class RequestHistoryInterceptor implements NestInterceptor {
  constructor(
    private readonly buffer: RequestHistoryBufferService,
    private readonly reflector: Reflector,
    @Inject(DEVTOOLS_OPTIONS_TOKEN)
    private readonly options: DevtoolsMcpOptions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = this.safeGetHttpContext(context)
    if (!http || this.isDevtoolsRequest(http.request)) {
      return next.handle()
    }

    // The middleware fallback records only requests that never reach a route handler.
    http.request[REQUEST_HISTORY_RECORDED] = true

    const startedAt = Date.now()
    let recorded = false

    const record = (statusCode: number, error: RequestHistoryError | null) => {
      if (recorded) {
        return
      }

      recorded = true
      http.request[REQUEST_HISTORY_RECORDED] = true

      try {
        this.buffer.add({
          method: this.getMethod(http.request),
          path: this.getPath(http.request),
          routePattern: this.getRoutePattern(context),
          statusCode,
          durationMs: Date.now() - startedAt,
          controllerName: this.getControllerName(context),
          handlerName: this.getHandlerName(context),
          ip: this.getIp(http.request),
          userAgent: this.getHeaderValue(http.request, 'user-agent'),
          requestSize: this.getContentLength(http.request),
          responseSize: this.getResponseSize(http.response),
          error,
        })
      } catch {
        // Request history must never affect the host application's behavior.
      }
    }

    this.onResponseFinished(http.response, () => {
      record(this.getStatusCode(http.response), null)
    })

    this.onResponseClosed(http.response, () => {
      if (!this.isResponseFinished(http.response)) {
        record(0, {
          name: 'ClientAborted',
          message: 'Client disconnected before response completed',
          stack: null,
        })
      }
    })

    return next.handle().pipe(
      catchError((error: unknown) => {
        record(this.getErrorStatusCode(error, http.response), this.serializeError(error))
        return throwError(() => error)
      }),
      finalize(() => {
        if (!recorded && this.isResponseFinished(http.response)) {
          record(this.getStatusCode(http.response), null)
        }
      }),
    )
  }

  private safeGetHttpContext(context: ExecutionContext): { request: HttpRequestLike; response: HttpResponseLike } | null {
    try {
      const http = context.switchToHttp()
      const request = http.getRequest<HttpRequestLike>()
      const response = http.getResponse<HttpResponseLike>()

      if (!request || !response) {
        return null
      }

      return { request, response }
    } catch {
      return null
    }
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

  private getRoutePattern(context: ExecutionContext): string | null {
    const controllerPath = this.getMetadataPath(context.getClass())
    const handlerPath = this.getMetadataPath(context.getHandler())

    if (controllerPath === null && handlerPath === null) {
      return null
    }

    const basePath = controllerPath ?? ''
    const routePath = handlerPath ?? ''
    return `/${basePath}/${routePath}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  }

  private getMetadataPath(target: Parameters<Reflector['get']>[1] | undefined): string | null {
    if (!target) {
      return null
    }

    const value = this.reflector.get<string | string[]>(PATH_METADATA, target)
    const path = Array.isArray(value) ? value[0] : value

    if (typeof path !== 'string') {
      return null
    }

    return path.replace(/^\/+/, '').replace(/\/+$/, '')
  }

  private getControllerName(context: ExecutionContext): string | null {
    return context.getClass()?.name || null
  }

  private getHandlerName(context: ExecutionContext): string | null {
    return context.getHandler()?.name || null
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

  private getErrorStatusCode(error: unknown, response: HttpResponseLike): number {
    const maybeHttpError = error as { status?: unknown; getStatus?: () => number }

    if (typeof maybeHttpError.getStatus === 'function') {
      return maybeHttpError.getStatus()
    }

    if (typeof maybeHttpError.status === 'number') {
      return maybeHttpError.status
    }

    return this.getStatusCode(response) >= 400 ? this.getStatusCode(response) : 500
  }

  private serializeError(error: unknown): RequestHistoryError {
    if (error instanceof Error) {
      return {
        name: error.name || 'Error',
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? null : error.stack || null,
      }
    }

    return {
      name: 'Error',
      message: String(error),
      stack: null,
    }
  }

  private onResponseFinished(response: HttpResponseLike, listener: () => void) {
    response.once?.('finish', listener)
  }

  private onResponseClosed(response: HttpResponseLike, listener: () => void) {
    response.once?.('close', listener)
  }

  private isResponseFinished(response: HttpResponseLike): boolean {
    return response.writableEnded === true
  }

  private shouldCaptureRequestBody(request: HttpRequestLike): boolean {
    if (this.isMultipartRequest(request)) {
      return false
    }

    return this.options.captureRequestBody === true
  }

  private isMultipartRequest(request: HttpRequestLike): boolean {
    const contentType = this.getHeaderValue(request, 'content-type') || ''
    return /^multipart\//i.test(contentType)
  }
}
