import { ErrorBufferService } from '../error-buffer.service'
import { ErrorSource } from '../contracts/mcp-api.contract'

describe('ErrorBufferService', () => {
  const makeEntry = (overrides: Partial<Parameters<ErrorBufferService['add']>[0]> = {}) => ({
    source: 'runtime' as ErrorSource,
    name: 'Error',
    message: 'boom',
    stack: 'stack-trace',
    context: 'App',
    requestId: null,
    relatedLogTimestamp: null,
    ...overrides,
  })

  describe('circular buffer behavior', () => {
    it('uses errorBufferSize as capacity', () => {
      const service = new ErrorBufferService({ errorBufferSize: 3 } as any)
      service.add(makeEntry({ message: '1' }))
      service.add(makeEntry({ message: '2' }))
      service.add(makeEntry({ message: '3' }))
      service.add(makeEntry({ message: '4' }))
      const entries = service.get(100)
      expect(entries).toHaveLength(3)
      expect(entries.map((e) => e.message)).toEqual(['2', '3', '4'])
    })

    it('defaults capacity to 100 when option missing', () => {
      const service = new ErrorBufferService({} as any)
      expect(service.getStats().bufferSize).toBe(100)
    })

    it('auto-generates id and timestamp on add', () => {
      const service = new ErrorBufferService({ errorBufferSize: 10 } as any)
      const entry = service.add(makeEntry({ message: 'm1' }))
      expect(entry.id).toMatch(/^[0-9a-f-]{36}$/) // UUID v4
      expect(typeof entry.timestamp).toBe('number')
      expect(entry.timestamp).toBeGreaterThan(0)
    })
  })

  describe('filtering', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('filters by source', () => {
      const service = new ErrorBufferService({ errorBufferSize: 10 } as any)
      service.add(makeEntry({ source: 'bootstrap', message: 'b1' }))
      service.add(makeEntry({ source: 'runtime', message: 'r1' }))
      service.add(makeEntry({ source: 'unhandled', message: 'u1' }))
      expect(service.filter({ source: 'unhandled' }).map((e) => e.message)).toEqual(['u1'])
      expect(service.filter({ source: 'bootstrap' }).map((e) => e.message)).toEqual(['b1'])
    })

    it('filters by since (timestamp >= since)', () => {
      const service = new ErrorBufferService({ errorBufferSize: 10 } as any)
      jest.setSystemTime(1000)
      service.add(makeEntry({ message: 'old' }))
      jest.setSystemTime(2000)
      service.add(makeEntry({ message: 'new' }))
      expect(service.filter({ since: 1500 }).map((e) => e.message)).toEqual(['new'])
    })

    it('filters by requestId', () => {
      const service = new ErrorBufferService({ errorBufferSize: 10 } as any)
      service.add(makeEntry({ requestId: 'req-1', message: 'a' }))
      service.add(makeEntry({ requestId: 'req-2', message: 'b' }))
      service.add(makeEntry({ requestId: null, message: 'c' }))
      expect(service.filter({ requestId: 'req-1' }).map((e) => e.message)).toEqual(['a'])
      expect(service.filter({ requestId: null }).map((e) => e.message)).toEqual(['c'])
    })

    it('onlyUnhandled=true returns only unhandled + bootstrap', () => {
      const service = new ErrorBufferService({ errorBufferSize: 10 } as any)
      service.add(makeEntry({ source: 'runtime', message: 'r' }))
      service.add(makeEntry({ source: 'unhandled', message: 'u' }))
      service.add(makeEntry({ source: 'bootstrap', message: 'b' }))
      const result = service.filter({ onlyUnhandled: true })
      expect(result.map((e) => e.message).sort()).toEqual(['b', 'u'])
    })

    it('applies limit (returns newest N)', () => {
      const service = new ErrorBufferService({ errorBufferSize: 10 } as any)
      for (let i = 0; i < 5; i++) service.add(makeEntry({ message: `m${i}` }))
      expect(service.filter({ limit: 2 }).map((e) => e.message)).toEqual(['m3', 'm4'])
    })

    it('limit defaults to 50 and caps at 200', () => {
      const service = new ErrorBufferService({ errorBufferSize: 300 } as any)
      for (let i = 0; i < 250; i++) service.add(makeEntry({ message: `m${i}` }))
      expect(service.filter({})).toHaveLength(200)
    })
  })

  describe('getStats', () => {
    it('reports total, bufferSize, unhandledCount, capturedSince', () => {
      const service = new ErrorBufferService({ errorBufferSize: 10 } as any)
      service.add(makeEntry({ source: 'unhandled', message: 'u', timestamp: 5000 }))
      service.add(makeEntry({ source: 'runtime', message: 'r' }))
      const stats = service.getStats()
      expect(stats).toEqual({
        total: 2,
        bufferSize: 10,
        unhandledCount: 1,
        capturedSince: new Date(5000).toISOString(),
      })
    })

    it('returns capturedSince null when buffer empty', () => {
      const service = new ErrorBufferService({} as any)
      expect(service.getStats().capturedSince).toBeNull()
    })
  })

  describe('count (without limit)', () => {
    it('counts entries matching filters ignoring limit', () => {
      const service = new ErrorBufferService({ errorBufferSize: 300 } as any)
      for (let i = 0; i < 150; i++) service.add(makeEntry({ source: 'unhandled' }))
      for (let i = 0; i < 50; i++) service.add(makeEntry({ source: 'runtime' }))
      expect(service.count({ source: 'unhandled' })).toBe(150)
      expect(service.count({})).toBe(200)
    })
  })
})
