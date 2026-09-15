import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  // Restricted to the configured frontend origin (FRONTEND_ORIGIN) rather
  // than left open to any origin: with authentication now in place, a
  // wildcard CORS policy would let any site read this API's responses using
  // a visitor's own valid bearer token if they had one, or otherwise widen
  // the attack surface for no benefit. No FRONTEND_ORIGIN configured means
  // no cross-origin browser access — same-origin and non-browser clients
  // (curl, server-to-server) are unaffected, since CORS is a browser-only
  // restriction.
  const frontendOrigin = configService.get<string>('app.frontendOrigin');
  app.enableCors({
    origin: frontendOrigin ?? false,
    methods: ['GET', 'POST'],
  });

  app.setGlobalPrefix('api', { exclude: ['sync/users', 'health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Customer User Synchronization Service')
    .setDescription(
      'Synchronizes users from an external customer API into our database and exposes them via a versioned API. The UI lives in ../frontend (Next.js).',
    )
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
}

void bootstrap();
