import { RequestContextService } from '../request-context.service'

describe('RequestContextService (AsyncLocalStorage)', () => {
  it('returns null when no request context is active', () => {
    const svc = new RequestContextService()
    expect(svc.getRequestId()).toBeNull()
  })

  it('returns the requestId inside .run()', () => {
    const svc = new RequestContextService()
    svc.run('req-42', () => {
      expect(svc.getRequestId()).toBe('req-42')
    })
  })

  it('isolates contexts across async boundaries', async () => {
    const svc = new RequestContextService()
    const results: (string | null)[] = []
    await Promise.all([
      svc.run('A', async () => {
        await new Promise((r) => setTimeout(r, 10))
        results.push(svc.getRequestId())
      }),
      svc.run('B', async () => {
        results.push(svc.getRequestId())
      }),
    ])
    expect(results.sort()).toEqual(['A', 'B'])
  })
})
