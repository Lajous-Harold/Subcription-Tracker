/* Synchronise le catalogue des fournisseurs (idempotent). Aussi exécuté au démarrage de l'API. */
import { loadConfig } from '../src/core/config';
import { connectDatabase, disconnectDatabase } from '../src/core/db';
import { ensureProviderCatalog } from '../src/modules/providers/service';

const config = loadConfig();
await connectDatabase(config.MONGODB_URI);
const count = await ensureProviderCatalog();
process.stdout.write(`${count} fournisseurs synchronisés\n`);
await disconnectDatabase();
