import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { LocalhostOnlyGuard } from '../localhost-only.guard'

/**
 * Unit tests for LocalhostOnlyGuard — the security boundary preventing
 * external access to MCP endpoints.
 */
describe('LocalhostOnlyGuard', () => {
  let guard: LocalhostOnlyGuard

  beforeEach(() => {
    guard = new LocalhostOnlyGuard()
  })

  function createMockContext(remoteAddress: string | undefined): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          socket: { remoteAddress },
        }),
      }),
    } as unknown as ExecutionContext
  }

  // ── Allowed addresses ─────────────────────────────────────

  it('should allow IPv4 localhost 127.0.0.1', () => {
    const ctx = createMockContext('127.0.0.1')
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('should allow IPv6 localhost ::1', () => {
    const ctx = createMockContext('::1')
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('should allow IPv4-mapped IPv6 localhost ::ffff:127.0.0.1', () => {
    const ctx = createMockContext('::ffff:127.0.0.1')
    expect(guard.canActivate(ctx)).toBe(true)
  })

  // ── Blocked addresses ─────────────────────────────────────

  it('should reject private network IP 192.168.1.100', () => {
    const ctx = createMockContext('192.168.1.100')
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })

  it('should reject public IP 8.8.8.8', () => {
    const ctx = createMockContext('8.8.8.8')
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })

  it('should reject Docker bridge IP 172.17.0.1', () => {
    const ctx = createMockContext('172.17.0.1')
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })

  it('should reject IPv6 non-localhost address', () => {
    const ctx = createMockContext('::ffff:192.168.1.1')
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })

  // ── Edge: undefined remoteAddress ─────────────────────────

  it('should reject when remoteAddress is undefined', () => {
    const ctx = createMockContext(undefined)
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })

  // ── Error message quality ─────────────────────────────────

  it('should include the rejected IP address in the error message', () => {
    const ctx = createMockContext('10.0.0.5')
    try {
      guard.canActivate(ctx)
      throw new Error('Expected ForbiddenException')
    } catch (e) {
      expect((e as ForbiddenException).message).toContain('10.0.0.5')
    }
  })
})
