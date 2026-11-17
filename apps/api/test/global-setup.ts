import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Démarre un MongoDB éphémère pour toute la suite, isolé de la base de développement.
 * - MONGODB_TEST_URI : utilise une instance existante (ex. conteneur Docker) ;
 * - MONGOMS_SYSTEM_BINARY : utilise un binaire mongod local au lieu du téléchargement.
 * L'URI est transmise aux fichiers de test par process.env (hérité par les workers Jest).
 */
export default async function globalSetup() {
  if (process.env.MONGODB_TEST_URI) return;
  const server = await MongoMemoryServer.create();
  (globalThis as { __MONGOD__?: MongoMemoryServer }).__MONGOD__ = server;
  process.env.MONGODB_TEST_URI = server.getUri();
}
