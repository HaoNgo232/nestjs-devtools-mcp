import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<{ requestId: string }>()

  /**
   * Run a callback function within an AsyncLocalStorage context associated with a requestId.
   */
  run<T>(requestId: string, callback: () => T): T {
    return this.asyncLocalStorage.run({ requestId }, callback)
  }

  /**
   * Retrieve the current requestId from the active context, or null if outside a context.
   */
  getRequestId(): string | null {
    const store = this.asyncLocalStorage.getStore()
    return store ? store.requestId : null
  }
}
