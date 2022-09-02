import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT ?? 3006;
  Logger.log(`Starting server on port ${port}.`);

  // For Railway support.
  await app.listen(port, '0.0.0.0');
}

bootstrap();
