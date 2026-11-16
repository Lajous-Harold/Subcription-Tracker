import mongoose from 'mongoose';
import { logger } from './logger';

mongoose.set('strictQuery', true);
// Les filtres ne reçoivent jamais d'objets bruts venant du client : tout passe par Zod
// (chaînes, nombres, booléens), ce qui empêche l'injection d'opérateurs ($gt, $where…).

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  const connection = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info('MongoDB connecté');
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
