import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Guard này nhằm đảm bảo Endpoint MCP chỉ được truy cập từ localhost (bridge chạy trên cùng máy).
 * Ngăn chặn truy cập từ môi trường bên ngoài để bảo vệ dữ liệu runtime của dự án.
 */
@Injectable()
export class LocalhostOnlyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const remoteAddress = request.socket.remoteAddress;

    // Kiểm tra địa chỉ IPv4 và IPv6 (::1 cho localhost trong IPv6)
    const isLocalhost = 
      remoteAddress === '127.0.0.1' || 
      remoteAddress === '::1' || 
      remoteAddress === '::ffff:127.0.0.1';

    if (!isLocalhost) {
      throw new ForbiddenException(`Truy cập chỉ được phép từ localhost. IP nhận được: ${remoteAddress}`);
    }

    return true;
  }
}
