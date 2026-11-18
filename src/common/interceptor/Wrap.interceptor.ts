
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
@Injectable()
export class WrapIntercepro  implements NestInterceptor
{
    intercept(context: ExecutionContext, next: CallHandler<any>) {
        return  next.handle().pipe(map(data => ({data})))
    }
}