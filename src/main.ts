import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { logger } from './common/middleware/logger.middleware.js';
import { ValidationPipe } from '@nestjs/common';
import { LoggerInterceptor } from './common/interceptor/Logger.interceptor.js';
import { WrapIntercepro } from './common/interceptor/Wrap.interceptor.js';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(logger)
  app.use(helmet())
  app.useGlobalInterceptors(new LoggerInterceptor, new WrapIntercepro)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )
  app.enableCors({
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
