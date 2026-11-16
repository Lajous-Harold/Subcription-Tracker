import type { TestProject } from 'vitest/node';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Démarre un MongoDB éphémère pour la suite de tests.
 * - MONGODB_TEST_URI : utilise une instance existante (ex. conteneur Docker) ;
 * - MONGOMS_SYSTEM_BINARY : utilise un binaire mongod local au lieu du téléchargement.
 */
let server: MongoMemoryServer | null = null;

export default async function setup(project: TestProject) {
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    server = await MongoMemoryServer.create();
    uri = server.getUri();
  }
  project.provide('mongoUri', uri);
  return async () => {
    await server?.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
