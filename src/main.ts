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

  // The frontend may be served from localhost, a Dev Tunnel, or another
  // deployment URL, so reflect the requesting origin for browser access.
  // Credentials are not enabled, so this does not expose cookie-based auth.
  app.enableCors({
    origin: true,
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
