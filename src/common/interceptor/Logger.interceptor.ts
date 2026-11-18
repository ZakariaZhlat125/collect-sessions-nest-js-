import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
    private readonly logger = new Logger("HTTP")
    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {

        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const start = Date.now();

        return next.handle().pipe(
            tap(() => this.logger.log(
                `${req.method} test ${req.url} ${res.statusCode} -               ${Date.now() - start}ms`)
            )
        )

    }
}