import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getServers, setServers } from 'node:dns';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { UPLOADS_ROOT } from './uploads/receipt-files.js';
import { API_PREFIX } from './routes/index.js';

async function bootstrap() {
  if (existsSync('.env')) process.loadEnvFile('.env');

  // Node falls back to 127.0.0.1 when the OS only offers a link-local IPv6 resolver, which breaks mongodb+srv lookups.
  if (getServers().every((s) => s === '127.0.0.1' || s === '::1')) setServers(['8.8.8.8', '1.1.1.1']);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: [process.env.FRONTEND_URL ?? 'http://localhost:3000', 'https://account-management-gamma-amber.vercel.app'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Receipt files have unguessable UUID names; they are served without auth so <img>/<a> links work.
  app.useStaticAssets(UPLOADS_ROOT, { prefix: '/uploads/', index: false, dotfiles: 'deny' });
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
