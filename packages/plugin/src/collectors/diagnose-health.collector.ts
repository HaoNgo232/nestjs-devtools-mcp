import { Inject, Injectable } from '@nestjs/common'
import { DevtoolsCollector, CollectorResult } from './collector.interface'
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from '../devtools-mcp.options'
import { LogBufferService, LogEntry } from '../log-buffer.service'
import { RequestHistoryBufferService } from '../request-history-buffer.service'
import { ErrorBufferService } from '../error-buffer.service'
import { RouteCollector } from './route.collector'
import { ErrorCollector } from './error.collector'
import { McpErrorEntry } from '../contracts/mcp-api.contract'

export interface CorrelatedErrorEntry extends McpErrorEntry {
  correlatedLogs: LogEntry[]
}

export interface DiagnosticHealthData {
  server: {
    name: string
    uptime: number
    pid: number
    nodeVersion: string
  }
  routes: {
    total: number
  }
  traffic: {
    sampleSize: number
    distribution: {
      '2xx': number
      '3xx': number
      '4xx': number
      '5xx': number
    }
    errorRate: string
    slowestRequest?: {
      method: string
      path: string
      durationMs: number
      statusCode: number
    } | null
  }
  errors: {
    totalInBuffer: number
    unhandledCount: number
    recent: CorrelatedErrorEntry[]
  }
}

@Injectable()
export class DiagnoseHealthCollector implements DevtoolsCollector<DiagnosticHealthData> {
  readonly toolName = 'diagnose_health'
  readonly description = 'One-shot aggregated runtime health diagnostics'

  constructor(
    @Inject(DEVTOOLS_OPTIONS_TOKEN)
    private readonly options: DevtoolsMcpOptions,
    private readonly routeCollector: RouteCollector,
    private readonly errorCollector: ErrorCollector,
    private readonly logBuffer: LogBufferService,
    private readonly requestHistoryBuffer: RequestHistoryBufferService,
    private readonly errorBuffer: ErrorBufferService,
  ) {}

  async execute(params: Record<string, unknown>): Promise<CollectorResult<DiagnosticHealthData>> {
    const errorLimit =
      typeof params.recentErrorsLimit === 'number' && params.recentErrorsLimit > 0
        ? Math.min(params.recentErrorsLimit, 10)
        : 3

    // 1. Server info
    const server = {
      name: this.options.name || 'nestjs-app',
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version,
    }

    // 2. Routes info
    let totalRoutes: number
    try {
      const routesResult = await this.routeCollector.execute({})
      totalRoutes = Array.isArray(routesResult.data?.routes) ? routesResult.data.routes.length : 0
    } catch {
      totalRoutes = 0
    }

    // 3. Traffic breakdown from request history
    const requests = this.requestHistoryBuffer.get(100)
    const distribution = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }
    let slowest: { method: string; path: string; durationMs: number; statusCode: number } | null = null

    for (const req of requests) {
      const code = req.statusCode
      if (code >= 200 && code < 300) distribution['2xx']++
      else if (code >= 300 && code < 400) distribution['3xx']++
      else if (code >= 400 && code < 500) distribution['4xx']++
      else if (code >= 500) distribution['5xx']++

      if (!slowest || req.durationMs > slowest.durationMs) {
        slowest = {
          method: req.method,
          path: req.path,
          durationMs: req.durationMs,
          statusCode: req.statusCode,
        }
      }
    }

    const totalRequests = requests.length
    const errorCount = distribution['4xx'] + distribution['5xx']
    const errorRate = totalRequests > 0 ? `${((errorCount / totalRequests) * 100).toFixed(1)}%` : '0%'

    // 4. Errors & Correlated Logs (aggregate from ErrorCollector)
    let allErrors: McpErrorEntry[]
    let totalErrors: number
    let unhandledCount: number

    try {
      const errorResult = await this.errorCollector.execute({ limit: errorLimit, includeStack: true })
      allErrors = errorResult.data?.entries || []
      totalErrors = errorResult.data?.total ?? 0
      unhandledCount = errorResult.data?.unhandledCount ?? 0
    } catch {
      allErrors = this.errorBuffer.get(errorLimit)
      const stats = this.errorBuffer.getStats()
      totalErrors = stats.total
      unhandledCount = stats.unhandledCount
    }

    const recentErrors: CorrelatedErrorEntry[] = allErrors.map((err) => {
      const correlatedLogs: LogEntry[] = err.requestId
        ? this.logBuffer.getLogs(5, 'all', err.requestId)
        : this.logBuffer
            .getLogs(50)
            .filter((l) => Math.abs(l.timestamp - err.timestamp) <= 2000)
            .slice(-3)

      return {
        ...err,
        correlatedLogs,
      }
    })

    return {
      toolName: this.toolName,
      data: {
        server,
        routes: { total: totalRoutes },
        traffic: {
          sampleSize: totalRequests,
          distribution,
          errorRate,
          slowestRequest: slowest,
        },
        errors: {
          totalInBuffer: totalErrors,
          unhandledCount,
          recent: recentErrors,
        },
      },
    }
  }
}
