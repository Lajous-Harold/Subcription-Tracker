import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import mongoose from 'mongoose';
import { CLIENT_PLATFORM_HEADER } from '@subtracker/contracts';
import type { AppConfig } from './core/config';
import { setConfig } from './core/context';
import { errorHandler, notFoundHandler } from './core/errors';
import { logger } from './core/logger';
import { buildOpenApiDocument } from './openapi';
import { authModule, meModule } from './modules/auth/routes';
import { bankModule } from './modules/bank/routes';
import { dashboardModule } from './modules/dashboard/routes';
import { detectionModule } from './modules/detection/routes';
import { devModule } from './modules/dev/routes';
import { providersModule } from './modules/providers/routes';
import { subscriptionsModule } from './modules/subscriptions/routes';
import { transactionsModule } from './modules/transactions/routes';
import { webhooksModule } from './modules/webhooks/routes';

const API_PREFIX = '/api';

export function createApp(config: AppConfig) {
  setConfig(config);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // API JSON : la CSP par défaut suffit ; pas de mise à niveau forcée en HTTPS pour le Swagger local.
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || config.CORS_ORIGINS.includes(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', CLIENT_PLATFORM_HEADER],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  if (config.APP_ENV !== 'test') {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  }

  app.get('/health', async (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', database: dbUp ? 'up' : 'down' });
  });

  const api = Router();
  // Monté avant express.json() : la vérification HMAC exige le corps brut.
  api.use(webhooksModule.basePath, webhooksModule.router);
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());

  const modules = [
    authModule,
    meModule,
    providersModule,
    subscriptionsModule,
    detectionModule,
    bankModule,
    transactionsModule,
    dashboardModule,
    ...(config.ENABLE_DEV_ROUTES ? [devModule] : []),
  ];
  for (const module of modules) api.use(module.basePath, module.router);

  app.use(API_PREFIX, api);

  if (config.APP_ENV !== 'production') {
    const document = buildOpenApiDocument();
    app.get('/api/openapi.json', (_req, res) => res.json(document));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(document));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
