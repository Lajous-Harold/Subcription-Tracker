# Subscription Tracker

Application web et Android qui détecte les abonnements dans les opérations bancaires (via Powens), les fait confirmer par l'utilisateur et aide à suivre leur résiliation. Tout fonctionne aussi sans banque connectée : chaque automatisme a son équivalent manuel.

**État (17/11/2026) :** le MVP est complet et testé, avec 55 tests d'intégration côté API (Jest + Supertest), 22 tests sur le moteur de détection, 4 tests côté app et un parcours web de bout en bout dans un navigateur. **Powens n'est validé que sur des réponses simulées.** La sandbox reste à valider avec de vrais identifiants (voir [Powens](#powens-sandbox)).

| Couche  | Choix                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------- |
| App     | Expo 58 + Expo Router + React Native Paper, TanStack Query (web + Android, code compatible iOS) |
| API     | Node 22 + Express 5, REST `/api`, Swagger généré depuis les schémas Zod                         |
| Données | MongoDB 8 + Mongoose                                                                            |
| Banque  | Powens (Webview Connect, API 2.0, webhooks HMAC)                                                |
| Qualité | TypeScript strict, ESLint, Prettier, Jest + Supertest, GitHub Actions, Docker                   |

## Démarrage rapide

Prérequis : Node 22, Docker Desktop.

```bash
npm install

# 1. Configuration de l'API
cp apps/api/.env.example apps/api/.env
node -e "console.log('JWT_ACCESS_SECRET='+require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log('TOKEN_ENCRYPTION_KEY='+require('crypto').randomBytes(32).toString('base64'))"
# → coller ces deux lignes dans apps/api/.env

# 2. Backend + base de données en conteneurs
docker compose up -d --build
# API : http://localhost:4000 · Swagger : http://localhost:4000/api/docs · Santé : /health

# 3. Application
cp apps/mobile/.env.example apps/mobile/.env
npm run dev:mobile          # puis « w » pour le web (http://localhost:8081)
```

Pour voir la détection sans banque : onglet **Banque** > **Données de démonstration** > **Charger**. Des opérations fictives sont importées (Spotify, Netflix, ChatGPT, une salle de sport, un abonnement arrêté, un loyer, des courses…) puis analysées.

API sans Docker (rechargement à chaud) : `docker compose up -d mongo`, puis `npm run dev:api`.

## Android

| Besoin                                           | Commande                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Tout sauf la connexion bancaire                  | `npm run dev:mobile` puis Expo Go (QR code)                                                                    |
| Parcours bancaire (lien profond `subtracker://`) | build de développement : `cd apps/mobile && npx eas-cli@latest build --profile development --platform android` |
| APK de démonstration                             | `npx eas-cli@latest build --profile preview --platform android`                                                |

Expo Go ne sert pas pour le parcours bancaire : son URL de retour `exp://<ip>` change avec le réseau, et Powens ne l'accepte pas en liste blanche.

Adresse de l'API vue par l'app (`EXPO_PUBLIC_API_URL`) :

- émulateur : `http://10.0.2.2:4000/api` ;
- téléphone physique : `http://<IP-du-PC>:4000/api`, sur le même réseau.

## Powens (sandbox)

Le code est prêt. La configuration se fait dans la console Powens, puis dans `apps/api/.env`.

1. Créer le compte et l'organisation sur la console, puis un domaine sandbox (`<projet>-sandbox.biapi.pro`).
2. **Client Applications** > **Add a client**. URL de redirection à mettre en liste blanche :
   - `subtracker://powens/callback` (Android) ;
   - `http://localhost:8081/powens/callback` (web en dev) ;
   - l'URL HTTPS du web déployé.
3. Renseigner `POWENS_DOMAIN`, `POWENS_CLIENT_ID` et `POWENS_CLIENT_SECRET` dans `apps/api/.env`.
4. Vérifier la sandbox : `npm run powens:smoke -w @subtracker/api`. Le script crée un utilisateur temporaire, affiche l'URL de la Webview, lit les comptes puis supprime l'utilisateur.
5. Webhooks (facultatif en dev, la synchronisation fonctionne aussi sans) :
   - créer une URL par événement : `https://<api>/api/webhooks/powens/CONNECTION_SYNCED` (idem pour `CONNECTION_DELETED` et `USER_DELETED`) ;
   - créer le fournisseur d'authentification HMAC, et copier aussitôt la clé dans `POWENS_WEBHOOK_SECRET` (elle n'est affichée qu'une fois) ;
   - en local, exposer l'API avec `cloudflared tunnel --url http://localhost:4000` ou ngrok, et mettre l'URL du tunnel dans `PUBLIC_API_URL`.
6. Tester le parcours avec le **Connecteur de test** : identifiant libre, mot de passe `1234`.

**À vérifier au premier essai réel** (non précisé dans la documentation consultée) :

- Powens accepte-t-il `http://localhost` comme URL de redirection ? Sinon, passer par un tunnel HTTPS.
- Le format exact de « endpoint » dans la signature des webhooks : l'API accepte le chemin seul ou l'URL complète.
- Le contenu du payload `CONNECTION_SYNCED` : l'API ne s'en sert que pour identifier l'utilisateur, puis relit tout.
- Le jeton requis pour créer le fournisseur HMAC (`POST /webhooks/auth`).
- Le connecteur de test produit-il des prélèvements mensuels ? Sinon, la détection se démontre avec les données de démonstration.
- Le type Powens d'un prélèvement SEPA (`order` supposé). Il est réglable dans `packages/detection/src/engine.ts`.

## Organisation du dépôt

```
apps/api            Express : modules auth, bank, powens, transactions, detection, subscriptions,
                    providers, dashboard, webhooks, dev — chacun routes → service → modèles
apps/mobile         Expo Router : src/app (routes), src/features, src/components, src/lib
packages/contracts  Schémas Zod partagés → types front/back + OpenAPI (une seule source de vérité)
packages/detection  Moteur de détection pur (sans I/O, indépendant de Powens) + fixtures
```

Le compte rendu technique complet (architecture, modèle de données, flux, risques) est [ici](https://claude.ai/artifact/7pWwKBMPp63wddAMKXktpw).

## Commandes

| Commande                                                        | Rôle                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| `npm run dev:api` / `npm run dev:mobile`                        | Développement                                                |
| `npm test`                                                      | Tous les tests (MongoDB éphémère téléchargé automatiquement) |
| `npm run lint` · `npm run typecheck` · `npm run format`         | Qualité                                                      |
| `npm run build:api` · `npm run build:web -w @subtracker/mobile` | Builds                                                       |
| `npm run openapi`                                               | Écrit `apps/api/openapi.json`                                |
| `npm run seed:providers -w @subtracker/api`                     | Resynchronise le catalogue (aussi fait au démarrage)         |

Tests avec une base existante : `MONGODB_TEST_URI=mongodb://localhost:27017 npm test`.

Tests : Jest + Supertest sur l'application Express importée sans ouvrir de port, avec une base MongoDB de test isolée (créée puis supprimée à chaque fichier). Jest tourne en mode ESM natif (`--experimental-vm-modules`), car l'API est en ESM. Le fichier `apps/api/test/requirements.test.ts` couvre les exigences minimales : parcours CRUD nominal, données invalides (400), accès sans JWT valide (401) et isolation entre deux comptes (404).

Un seul fichier ou un seul test : `npm test -w @subtracker/api -- test/requirements.test.ts -t "isolation"`.

## Choix et limites du MVP

- **Provenance de chaque valeur.** Observée (opérations bancaires), déclarée (saisie ou corrigée) ou estimée (calculée). Une valeur déclarée n'est jamais réécrite par la détection ; « Remettre en automatique » rend la main aux données observées.
- **Détection.**
  - Mensuelle uniquement, à règles explicables : regroupement par marchand et par montant, rythme mensuel, score de confiance plafonné à 95 %.
  - Les virements sont exclus (loyer, épargne). Un candidat rejeté n'est jamais reproposé.
  - Aucun abonnement n'est créé sans confirmation de l'utilisateur.
- **Données minimales.**
  - Seuls les débits sont importés, et seulement ceux des comptes « analysés ».
  - Aucun identifiant bancaire ni numéro de carte n'est stocké.
  - Le token Powens est chiffré (AES-256-GCM) et ne quitte jamais l'API.
  - Rétention de 5 ans (`DATA_RETENTION_YEARS`). La conformité RGPD est à instruire avant toute production.
- **Une connexion bancaire par utilisateur.** Le consentement se gère dans la Webview Powens ; une alerte s'affiche 14 jours avant son expiration.
- **Sessions.**
  - Access token de 15 min gardé en mémoire.
  - Refresh token rotatif : réutiliser un ancien token révoque toute la session.
  - Stockage du refresh token : cookie httpOnly `SameSite=Strict` sur le web, trousseau sécurisé sur mobile. En production web, l'API et l'app doivent donc être sur le même site (ex. `api.exemple.fr` et `app.exemple.fr`).
- **Aucune résiliation automatique.** Le catalogue (29 services) donne le lien officiel et des instructions. 9 procédures ont été confirmées sur les pages officielles le 16/11/2026 ; les autres sont signalées « non vérifiées » dans l’app. Supprimer un abonnement dans l'app ne résilie pas le contrat.
- **Non exhaustif par nature.** Une opération ne prouve pas un abonnement actif, et une absence de prélèvement ne prouve pas une résiliation : l'app affiche un signal, jamais un changement de statut automatique.
- **Hors MVP.** Plusieurs banques, abonnements annuels, graphiques avancés, résiliation automatisée, iOS testé.
