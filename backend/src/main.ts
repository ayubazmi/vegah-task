import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  // localhost:4000 kholne pe "Cannot GET /" na aaye
  app.getHttpAdapter().get('/', (_req: unknown, res: { json: (b: unknown) => void }) =>
    res.json({
      name: 'Dispatch Board API',
      status: 'running',
      try: ['/api/health', '/api/jobs'],
      frontend: 'http://localhost:3000',
    }),
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`API ready on http://localhost:${port}/api`);
}
bootstrap();
