import { LogCollector } from '../log.collector'
import { LogBufferService, LogEntry } from '../../log-buffer.service'

/**
 * Unit tests for LogCollector — the first concrete DevtoolsCollector implementation.
 * Validates that filtering logic (previously in controller) works correctly after extraction.
 */
describe('LogCollector', () => {
  let collector: LogCollector
  let mockLogBuffer: jest.Mocked<Pick<LogBufferService, 'getLogs' | 'getStats'>>

  const fakeLogs: LogEntry[] = [
    { timestamp: 1000, level: 'log', message: 'msg1', context: 'App' },
    { timestamp: 2000, level: 'error', message: 'msg2', context: 'App' },
    { timestamp: 3000, level: 'warn', message: 'msg3', context: 'App' },
  ]

  beforeEach(() => {
    mockLogBuffer = {
      getLogs: jest.fn().mockReturnValue(fakeLogs),
      getStats: jest.fn().mockReturnValue({ total: 3, bufferSize: 500 }),
    }
    collector = new LogCollector(mockLogBuffer as unknown as LogBufferService)
  })

  // ── Identity ──────────────────────────────────────────────

  it('should expose toolName as "get_logs"', () => {
    expect(collector.toolName).toBe('get_logs')
  })

  it('should expose a non-empty description', () => {
    expect(collector.description).toBeTruthy()
    expect(typeof collector.description).toBe('string')
  })

  // ── Default parameters ────────────────────────────────────

  it('should use default lines=50 and level="all" when params is empty', async () => {
    await collector.execute({})

    expect(mockLogBuffer.getLogs).toHaveBeenCalledWith(50, 'all')
    expect(mockLogBuffer.getStats).toHaveBeenCalledTimes(1)
  })

  // ── Custom parameters ─────────────────────────────────────

  it('should forward explicit lines and level to LogBufferService', async () => {
    await collector.execute({ lines: 10, level: 'error' })

    expect(mockLogBuffer.getLogs).toHaveBeenCalledWith(10, 'error')
  })

  it('should forward explicit requestId to LogBufferService', async () => {
    await collector.execute({ lines: 10, level: 'error', requestId: 'req-123' })

    expect(mockLogBuffer.getLogs).toHaveBeenCalledWith(10, 'error', 'req-123')
  })

  // ── Response shape ────────────────────────────────────────

  it('should return CollectorResult with correct toolName and data shape', async () => {
    const result = await collector.execute({})

    expect(result.toolName).toBe('get_logs')
    expect(result.data).toEqual({
      entries: fakeLogs,
      total: 3,
      bufferSize: 500,
    })
  })

  // ── Edge: non-number lines falls back to default ──────────

  it('should fall back to default when lines is a string instead of number', async () => {
    await collector.execute({ lines: '25' as unknown })

    // typeof '25' !== 'number', so should use default 50
    expect(mockLogBuffer.getLogs).toHaveBeenCalledWith(50, 'all')
  })

  it('should fall back to default when level is a number instead of string', async () => {
    await collector.execute({ level: 123 as unknown })

    // typeof 123 !== 'string', so should use default 'all'
    expect(mockLogBuffer.getLogs).toHaveBeenCalledWith(50, 'all')
  })

  // ── Edge: partial params ──────────────────────────────────

  it('should accept only lines without level', async () => {
    await collector.execute({ lines: 5 })

    expect(mockLogBuffer.getLogs).toHaveBeenCalledWith(5, 'all')
  })

  it('should accept only level without lines', async () => {
    await collector.execute({ level: 'warn' })

    expect(mockLogBuffer.getLogs).toHaveBeenCalledWith(50, 'warn')
  })
})
