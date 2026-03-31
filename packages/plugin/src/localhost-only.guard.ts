import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Observable } from 'rxjs'

/**
 * This Guard ensures that the MCP Endpoint is only accessible from localhost (bridge running on the same machine).
 * Prevents external access to protect the project's runtime data.
 */
@Injectable()
export class LocalhostOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest()
    const remoteAddress = request.socket.remoteAddress

    // Check IPv4 and IPv6 addresses (::1 for localhost in IPv6)
    const isLocalhost = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1'

    if (!isLocalhost) {
      throw new ForbiddenException(`Access allowed only from localhost. Received IP: ${remoteAddress}`)
    }

    return true
  }
}
