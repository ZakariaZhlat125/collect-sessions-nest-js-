import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtPayload } from "../auth.service.js";
import { ROLES_KEY } from "../decorator/roles.decorator.js";


@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles) return true;

    const user: JwtPayload = context.switchToHttp().getRequest().user;
    if (!roles.includes(user.role)) throw new ForbiddenException('Forbidden');
    return true;
  }
}

