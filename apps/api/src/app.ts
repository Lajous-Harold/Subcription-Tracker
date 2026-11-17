import { resolve } from 'node:path';
import express, { Router, type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { CLIENT_PLATFORM_HEADER } from '@subtracker/contracts';
import type { AppConfig } from './core/config';
import { setConfig } from './core/context';
import { errorHandler, notFoundHandler } from './core/errors';
import { logger } from './core/logger';
import { API_PREFIX } from './core/paths';
import { buildOpenApiDocument } from './openapi';
import { authModule, meModule } from './modules/auth/routes';
import { bankModule } from './modules/bank/routes';
import { dashboardModule } from './modules/dashboard/routes';
import { detectionModule } from './modules/detection/routes';
import { demoModule } from './modules/demo/routes';
import { healthModule } from './modules/health/routes';
import { providersModule } from './modules/providers/routes';
import { subscriptionsModule } from './modules/subscriptions/routes';
import { transactionsModule } from './modules/transactions/routes';
import { webhooksModule } from './modules/webhooks/routes';

const HEALTH_PATH = `${API_PREFIX}${healthModule.basePath}`;

const isApiPath = (path: string) => path === API_PREFIX || path.startsWith(`${API_PREFIX}/`);

/** Les routes de l'app sont résolues côté client : tout GET hors de l'API retombe sur index.html. */
function serveWebApp(app: Express, webDistDir: string) {
  const indexHtml = resolve(webDistDir, 'index.html');
  app.use(express.static(webDistDir));
  app.get(/.*/, (req, res, next) => {
    if (isApiPath(req.path)) return next();
    res.sendFile(indexHtml);
  });
}

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
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === HEALTH_PATH } }));
  }

  const api = Router();
  // Monté avant express.json() : la vérification HMAC exige le corps brut.
  api.use(webhooksModule.basePath, webhooksModule.router);
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());

  const modules = [
    healthModule,
    authModule,
    meModule,
    providersModule,
    subscriptionsModule,
    detectionModule,
    bankModule,
    transactionsModule,
    dashboardModule,
    ...(config.ENABLE_DEMO_DATA ? [demoModule] : []),
  ];
  for (const module of modules) api.use(module.basePath, module.router);

  app.use(API_PREFIX, api);

  const openApiDocument = buildOpenApiDocument();
  app.get(`${API_PREFIX}/openapi.json`, (_req, res) => res.json(openApiDocument));
  app.use(`${API_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(openApiDocument));

  if (config.WEB_DIST_DIR) serveWebApp(app, config.WEB_DIST_DIR);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
