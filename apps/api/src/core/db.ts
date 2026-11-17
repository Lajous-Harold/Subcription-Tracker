import mongoose from 'mongoose';
import { logger } from './logger';

// Les filtres ne reçoivent jamais d'objet brut du client : tout passe par Zod (valeurs scalaires),
// ce qui empêche l'injection d'opérateurs ($gt, $where…).
mongoose.set('strictQuery', true);

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  const connection = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info('MongoDB connecté');
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
