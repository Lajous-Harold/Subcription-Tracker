#!/usr/bin/env node
// Vérifie la version en ligne avant une présentation : réveil du service gratuit, parcours de démo, nettoyage.
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const WAKE_UP_TIMEOUT_MS = 3 * 60_000;
const WAKE_UP_RETRY_DELAY_MS = 5_000;
const REQUEST_TIMEOUT_MS = 30_000;
const EXPECTED_HEALTH_BODY = JSON.stringify({ status: 'ok' });

class CheckFailure extends Error {}

const EXIT_CODE_BY_SIGNAL = { SIGINT: 130, SIGTERM: 143 };

const baseUrl = readBaseUrl();
const state = { healthResponse: undefined, disposableAccount: undefined, accountCleanup: undefined };

for (const [signal, exitCode] of Object.entries(EXIT_CODE_BY_SIGNAL)) {
  // `once` : un second Ctrl+C pendant la suppression quitte immédiatement.
  process.once(signal, () => void exitAfterCleanup(signal, exitCode));
}

const steps = [
  ['Réveil du service (GET /api/health)', wakeUpService],
  ['Corps de /api/health', checkHealthBody],
  ['Inscription du compte jetable', registerDisposableAccount],
  ['Chargement des données de démo', loadDemoData],
  ['Détection des abonnements candidats', checkCandidatesDetected],
  ['Documentation Swagger (/api/docs/)', checkSwaggerDocs],
  ['Application web (/)', checkWebApp],
];

console.log(`Vérification de ${baseUrl}\n`);

let allStepsPassed = true;
for (const [label, action] of steps) {
  if (!(await runStep(label, action))) {
    allStepsPassed = false;
    break;
  }
}
if (state.disposableAccount) {
  const accountDeleted = await cleanUpDisposableAccount();
  allStepsPassed = allStepsPassed && accountDeleted;
}

console.log(allStepsPassed ? '\nTout est prêt pour la présentation.' : '\nÉchec : voir les étapes marquées ✗.');
process.exitCode = allStepsPassed ? 0 : 1;

async function exitAfterCleanup(signal, exitCode) {
  console.log(`\nInterruption (${signal}).`);
  if (state.disposableAccount) await cleanUpDisposableAccount();
  process.exit(exitCode);
}

function cleanUpDisposableAccount() {
  state.accountCleanup ??= runStep('Suppression du compte jetable', deleteDisposableAccount);
  return state.accountCleanup;
}

function readBaseUrl() {
  const rawUrl = process.argv[2] ?? process.env.DEMO_URL;
  if (!rawUrl || !URL.canParse(rawUrl)) {
    console.error(
      [
        rawUrl ? `URL invalide : ${rawUrl}\n` : 'URL de la version en ligne manquante.\n',
        'Usage : npm run demo:check -- <URL>',
        '   ou : node scripts/demo-check.mjs <URL>',
        '   ou : DEMO_URL=<URL> npm run demo:check',
        '',
        'Exemple : npm run demo:check -- https://subscription-tracker.onrender.com',
      ].join('\n'),
    );
    process.exit(1);
  }
  return rawUrl.replace(/\/+$/, '');
}

async function runStep(label, action) {
  const startedAt = performance.now();
  try {
    const detail = await action();
    console.log(`✓ ${label} (${formatDuration(performance.now() - startedAt)})${detail ? ` : ${detail}` : ''}`);
    return true;
  } catch (error) {
    console.log(`✗ ${label} (${formatDuration(performance.now() - startedAt)}) : ${describeError(error)}`);
    return false;
  }
}

async function wakeUpService() {
  const startedAt = Date.now();
  const deadline = startedAt + WAKE_UP_TIMEOUT_MS;
  for (;;) {
    const timeoutMs = Math.max(1_000, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()));
    let notReadyReason;
    try {
      const response = await request('GET', '/api/health', { timeoutMs });
      if (response.status === 200) {
        state.healthResponse = response;
        return;
      }
      // Render répond 5xx tant que l'instance gratuite redémarre ; tout autre statut vient de l'API elle-même.
      if (response.status < 500) throw new CheckFailure(`le service répond, mais ${describeHttpError(response)}`);
      notReadyReason = `HTTP ${response.status}`;
    } catch (error) {
      if (error instanceof CheckFailure) throw error;
      notReadyReason = describeError(error);
    }
    if (Date.now() + WAKE_UP_RETRY_DELAY_MS >= deadline) {
      throw new CheckFailure(`toujours indisponible après 3 min (${notReadyReason})`);
    }
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    console.log(`  … pas encore prêt (${notReadyReason}), nouvel essai dans 5 s, ${elapsedSeconds} s écoulées`);
    await sleep(WAKE_UP_RETRY_DELAY_MS);
  }
}

function checkHealthBody() {
  const { json, text } = state.healthResponse;
  if (JSON.stringify(json) !== EXPECTED_HEALTH_BODY) {
    throw new CheckFailure(`attendu ${EXPECTED_HEALTH_BODY}, reçu ${text.slice(0, 200)}`);
  }
}

async function registerDisposableAccount() {
  const email = `demo-check-${Date.now()}@example.com`;
  const password = `Dc1!${randomUUID()}`;
  const response = await request('POST', '/api/auth/register', {
    body: { email, password },
    headers: { 'x-client-platform': 'native' },
  });
  expectStatus(response, 201);
  const accessToken = response.json?.accessToken;
  if (typeof accessToken !== 'string') throw new CheckFailure('accessToken absent de la réponse');
  state.disposableAccount = { email, password, accessToken };
  return email;
}

async function loadDemoData() {
  const response = await request('POST', '/api/demo/data', { accessToken: state.disposableAccount.accessToken });
  expectStatus(response, 200);
}

async function checkCandidatesDetected() {
  const response = await request('GET', '/api/detection/candidates', {
    accessToken: state.disposableAccount.accessToken,
  });
  expectStatus(response, 200);
  const candidateCount = Array.isArray(response.json?.items) ? response.json.items.length : 0;
  if (candidateCount === 0) throw new CheckFailure('aucun candidat détecté');
  return `${candidateCount} candidat(s)`;
}

async function checkSwaggerDocs() {
  expectStatus(await request('GET', '/api/docs/'), 200);
}

async function checkWebApp() {
  const response = await request('GET', '/');
  expectStatus(response, 200);
  if (!response.contentType.includes('text/html')) {
    throw new CheckFailure(`HTML attendu, type de contenu reçu : ${response.contentType || 'absent'}`);
  }
}

async function deleteDisposableAccount() {
  const { email, password, accessToken } = state.disposableAccount;
  const response = await request('DELETE', '/api/me', { accessToken, body: { password } });
  expectStatus(response, 204);
  return email;
}

async function request(method, path, { accessToken, body, headers = {}, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    text,
    json: parseJsonOrUndefined(text),
  };
}

function parseJsonOrUndefined(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function expectStatus(response, expectedStatus) {
  if (response.status !== expectedStatus) {
    throw new CheckFailure(`${expectedStatus} attendu, ${describeHttpError(response)}`);
  }
}

function describeHttpError(response) {
  return `HTTP ${response.status}, code ${response.json?.error?.code ?? 'absent'}`;
}

function describeError(error) {
  if (error instanceof CheckFailure) return error.message;
  if (error?.name === 'TimeoutError') return 'délai de réponse dépassé';
  return `erreur réseau (${error?.cause?.code ?? error?.message ?? error})`;
}

function formatDuration(milliseconds) {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(1).replace('.', ',')} s`;
}
