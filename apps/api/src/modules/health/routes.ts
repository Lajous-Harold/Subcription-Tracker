import mongoose from 'mongoose';
import { HealthResponseSchema, type HealthResponse } from '@subtracker/contracts';
import { createModule } from '../../core/http';
import { serviceUnavailable } from '../../core/errors';

const MONGOOSE_CONNECTED = 1;

export const healthModule = createModule('/health', 'Santé');

healthModule.route({
  method: 'get',
  path: '/',
  summary: 'État de santé de l’API',
  description: 'Répond 200 si la base de données est joignable, 503 SERVICE_UNAVAILABLE sinon.',
  auth: false,
  response: HealthResponseSchema,
  errors: [503],
  handler: (): HealthResponse => {
    if (mongoose.connection.readyState !== MONGOOSE_CONNECTED) {
      throw serviceUnavailable('Base de données indisponible');
    }
    return { status: 'ok' };
  },
});
