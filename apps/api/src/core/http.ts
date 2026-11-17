import { Router, type Request, type RequestHandler, type Response } from 'express';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z, type ZodType } from 'zod';
import { ApiErrorSchema } from '@subtracker/contracts';
import { requireAuth } from '../modules/auth/middleware';

export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface RouteContext<B, Q, P> {
  req: Request;
  res: Response;
  body: B;
  query: Q;
  params: P;
  /** Chaîne vide sur une route publique (`auth: false`). */
  userId: string;
}

interface RouteSpec<B extends ZodType | undefined, Q extends ZodType | undefined, P extends ZodType | undefined> {
  method: Method;
  /** Chemin relatif au module, syntaxe Express (`/:id`). */
  path: string;
  summary: string;
  description?: string;
  auth?: boolean;
  body?: B;
  query?: Q;
  params?: P;
  status?: number;
  response?: ZodType;
  /** Codes d'erreur documentés en plus de 400/401. */
  errors?: number[];
  middlewares?: RequestHandler[];
  handler: (
    ctx: RouteContext<
      B extends ZodType ? z.infer<B> : undefined,
      Q extends ZodType ? z.infer<Q> : undefined,
      P extends ZodType ? z.infer<P> : undefined
    >,
  ) => Promise<unknown> | unknown;
}

const errorContent = { 'application/json': { schema: ApiErrorSchema } };

/** Les mêmes schémas Zod valident chaque route et la documentent : pas de dérive entre code et Swagger. */
export function createModule(basePath: string, tag: string) {
  const router = Router();

  function route<
    B extends ZodType | undefined = undefined,
    Q extends ZodType | undefined = undefined,
    P extends ZodType | undefined = undefined,
  >(spec: RouteSpec<B, Q, P>) {
    const auth = spec.auth ?? true;
    const status = spec.status ?? (spec.method === 'post' ? 201 : 200);
    const openApiPath = `${basePath}${spec.path}`.replace(/:(\w+)/g, '{$1}').replace(/\/$/, '') || '/';

    const errorResponses: Record<string, { description: string; content: typeof errorContent }> = {
      400: { description: 'Requête invalide', content: errorContent },
    };
    if (auth) errorResponses[401] = { description: 'Non authentifié', content: errorContent };
    for (const code of spec.errors ?? []) {
      errorResponses[code] = { description: 'Erreur', content: errorContent };
    }

    openApiRegistry.registerPath({
      method: spec.method,
      path: openApiPath,
      tags: [tag],
      summary: spec.summary,
      description: spec.description,
      security: auth ? [{ bearerAuth: [] }] : [],
      request: {
        ...(spec.params ? { params: spec.params as never } : {}),
        ...(spec.query ? { query: spec.query as never } : {}),
        ...(spec.body ? { body: { content: { 'application/json': { schema: spec.body } } } } : {}),
      },
      responses: {
        [status]:
          status === 204 || !spec.response
            ? { description: 'Succès' }
            : { description: 'Succès', content: { 'application/json': { schema: spec.response } } },
        ...errorResponses,
      },
    });

    const handlers: RequestHandler[] = [...(spec.middlewares ?? [])];
    if (auth) handlers.unshift(requireAuth);
    handlers.push(async (req, res) => {
      const ctx = {
        req,
        res,
        body: spec.body ? spec.body.parse(req.body ?? {}) : undefined,
        query: spec.query ? spec.query.parse(req.query) : undefined,
        params: spec.params ? spec.params.parse(req.params) : undefined,
        userId: req.auth?.userId ?? '',
      } as Parameters<typeof spec.handler>[0];
      const result = await spec.handler(ctx);
      if (res.headersSent) return;
      if (status === 204 || result === undefined) {
        res.status(status === 200 && result === undefined ? 204 : status).end();
        return;
      }
      res.status(status).json(result);
    });

    router[spec.method](spec.path, ...handlers);
  }

  return { router, route, basePath };
}

export const IdParamsSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i, 'Identifiant invalide') });
