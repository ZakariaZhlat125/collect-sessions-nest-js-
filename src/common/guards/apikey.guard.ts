import { CanActivate, ExecutionContext, ForbiddenException, Injectable, MethodNotAllowedException, UnauthorizedException } from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class ApiGuard implements CanActivate {

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const req = context.switchToHttp().getRequest();
        if (req.headers["role"] !== "Admin") {
            throw new ForbiddenException("invaild api key")
        }

        return true;

    }
}