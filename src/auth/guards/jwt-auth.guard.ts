import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { JwtPayload } from "../auth.service.js";



@Injectable()
export class JwtAuthGuard implements CanActivate {

  constructor(private readonly jwtService: JwtService) { }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];

    if (type !== "Bearer" || !token) throw new UnauthorizedException("Not logged in");

    try {
      req.user = await this.jwtService.verifyAsync<JwtPayload>(token);   // { userId, role, iat, exp }
    } catch {
      throw new UnauthorizedException("invalid or expired token")
    }
    return true;
  }
}