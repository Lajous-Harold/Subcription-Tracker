/**
 * Vérification manuelle de la sandbox Powens (jamais en CI : secrets et service externe).
 * Crée un utilisateur Powens temporaire, génère un code et affiche l'URL Webview à ouvrir,
 * puis supprime l'utilisateur. Usage : npm run powens:smoke -w @subtracker/api
 */
import { loadConfig } from '../src/core/config';
import { setConfig } from '../src/core/context';
import { createPowensClient } from '../src/modules/powens';

const config = loadConfig();
setConfig(config);
if (!config.powensConfigured) {
  process.stderr.write('POWENS_DOMAIN, POWENS_CLIENT_ID et POWENS_CLIENT_SECRET sont requis dans apps/api/.env\n');
  process.exit(1);
}
const client = createPowensClient(config);

const user = await client.createUser();
process.stdout.write(`1. Utilisateur Powens créé (id ${user.powensUserId ?? 'inconnu'})\n`);
const code = await client.getTemporaryCode(user.token);
process.stdout.write('2. Code temporaire obtenu\n');
const url = client.buildWebviewUrl({
  flow: 'connect',
  code,
  state: 'smoke-test-state-000000',
  redirectUri: config.POWENS_REDIRECT_URI_WEB,
});
process.stdout.write(`3. URL Webview (Connecteur de test, mot de passe 1234) :\n   ${url}\n`);
const accounts = await client.listAccounts(user.token);
process.stdout.write(`4. Lecture des comptes OK (${accounts.length} compte(s) pour ce nouvel utilisateur)\n`);
await client.deleteUser(user.token);
process.stdout.write('5. Utilisateur Powens supprimé. Sandbox joignable et identifiants valides.\n');
