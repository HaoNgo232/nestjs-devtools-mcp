/**
 * Kết quả trả về từ một collector.
 * `data` chứa payload tuỳ thuộc từng tool — phía bridge sẽ serialize thành JSON cho AI client.
 */
export interface CollectorResult<T = Record<string, unknown>> {
  /** Tên tool MCP tương ứng, ví dụ: "get_logs", "get_routes" */
  readonly toolName: string

  /** Payload dữ liệu runtime */
  readonly data: T
}

/**
 * Interface mà mọi runtime data collector phải implement.
 *
 * Mỗi collector đảm nhận MỘT tool duy nhất (nguyên tắc Single Responsibility từ AGENTS.md).
 * Controller dispatch request đến đúng collector dựa trên `toolName`.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class LogCollector implements DevtoolsCollector {
 *   readonly toolName = 'get_logs';
 *   readonly description = 'Retrieve recent application logs';
 *
 *   constructor(private readonly logBuffer: LogBufferService) {}
 *
 *   async execute(params: Record<string, unknown>): Promise<CollectorResult> {
 *     const logs = this.logBuffer.getLogs(params.limit as number);
 *     return { toolName: this.toolName, data: { logs } };
 *   }
 * }
 * ```
 */
export interface DevtoolsCollector<T = Record<string, unknown>> {
  /** Identifier duy nhất — map 1:1 với MCP tool name phía bridge */
  readonly toolName: string

  /** Mô tả ngắn cho AI client biết tool này làm gì */
  readonly description: string

  /**
   * Thu thập dữ liệu runtime.
   * @param params - Tham số tuỳ chọn từ request body (đã validate bởi controller/guard).
   * @returns CollectorResult chứa data đã sẵn sàng serialize.
   */
  execute(params: Record<string, unknown>): CollectorResult<T> | Promise<CollectorResult<T>>
}

/**
 * DI Token để inject danh sách tất cả collectors đã đăng ký.
 * Sử dụng với NestJS multi-provider pattern:
 *
 * ```typescript
 * { provide: DEVTOOLS_COLLECTORS, useClass: LogCollector, multi: true }
 * ```
 */
export const DEVTOOLS_COLLECTORS = Symbol('DEVTOOLS_COLLECTORS')
