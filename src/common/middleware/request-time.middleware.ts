
import { NestMiddleware } from '@nestjs/common';
import { IncomingMessage, ServerResponse } from 'http';

export type AppRequest = IncomingMessage & { requestTime?: string }

export class RequestTimeMiddleware implements NestMiddleware {
    use(req: AppRequest, res: ServerResponse, next: () => void) {
        req.requestTime = new Date().toISOString();
        console.log("req.requestTime");
         next();
    }
}