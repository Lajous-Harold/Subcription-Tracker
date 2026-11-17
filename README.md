# Subscription Tracker

Application web et Android qui repère les abonnements dans les opérations bancaires, les fait confirmer par l'utilisateur et l'aide à suivre leur résiliation.

La connexion bancaire passe par [Powens](https://www.powens.com). Tout fonctionne aussi sans banque : chaque automatisme a son équivalent manuel, et des données de démonstration permettent d'essayer la détection.

## Fonctionnalités

- Comptes utilisateurs isolés : JWT de 15 min et refresh token rotatif.
- Suivi manuel des abonnements : montant, échéance, paiements, catalogue de 29 services.
- Détection des abonnements mensuels dans les opérations bancaires, avec un score de confiance et les raisons du rapprochement. Rien n'est créé sans confirmation.
- Aide à la résiliation : lien officiel et procédure de chaque service, suivi manuel de la démarche.
- Tableau de bord : total mensuel, projection annuelle, prochaines échéances.

## Stack

| Couche  | Technologies                                                                  |
| ------- | ----------------------------------------------------------------------------- |
| App     | Expo 58, Expo Router, React Native Paper, TanStack Query (web et Android)     |
| API     | Node 24, Express 5, REST `/api`, Swagger généré depuis les schémas Zod        |
| Données | MongoDB 8, Mongoose                                                           |
| Qualité | TypeScript strict, ESLint, Prettier, Jest + Supertest, GitHub Actions, Docker |

## Prérequis

- Node 24 (voir `.nvmrc`) et npm 11
- Docker Desktop

## Démarrage

```bash
# 1. Dépendances
npm ci

# 2. Configuration de l'API : copier l'exemple, puis générer les deux secrets
cp apps/api/.env.example apps/api/.env
node -e "console.log('JWT_ACCESS_SECRET='+require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log('TOKEN_ENCRYPTION_KEY='+require('crypto').randomBytes(32).toString('base64'))"
# → coller ces deux lignes dans apps/api/.env

# 3. MongoDB + API en conteneurs
docker compose up -d --build

# 4. Application web
cp apps/mobile/.env.example apps/mobile/.env
npm run web -w @subtracker/mobile
```

| Service                         | URL                              |
| ------------------------------- | -------------------------------- |
| Application web (Expo)          | http://localhost:8081            |
| Application web (export Docker) | http://localhost:4000            |
| API                             | http://localhost:4000/api        |
| Documentation Swagger           | http://localhost:4000/api/docs   |
| Santé de l'API                  | http://localhost:4000/api/health |

Le mot de passe d'inscription doit compter au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et un symbole.

Pour essayer la détection sans banque : créer un compte, puis ouvrir l'onglet **Banque** > **Données de démonstration** > **Charger**. Ces données passent par `POST` / `DELETE /api/demo/data`, actives par défaut hors production ; `ENABLE_DEMO_DATA=true` les active en production.

Pour développer l'API avec rechargement à chaud : `docker compose up -d mongo`, puis `npm run dev:api`.

Connexion bancaire réelle et application Android : voir [docs/powens.md](docs/powens.md).

## Essayer l'application en ligne

- **Web** : <https://subscription-tracker-42pr.onrender.com>. L'API est servie sur la même origine, sous `/api`.
- **Android** : l'APK se télécharge sur `<lien EAS>`.
- **Expo Go** : mettre `EXPO_PUBLIC_API_URL=https://subscription-tracker-42pr.onrender.com/api` dans `apps/mobile/.env`, lancer `npm run expo-go`, puis scanner le QR code avec l'appareil photo (iOS) ou avec Expo Go (Android).

L'hébergement gratuit endort le service après 15 min sans trafic, et le réveil prend environ 1 min. Avant une présentation, lancer `npm run demo:check -- https://subscription-tracker-42pr.onrender.com` : le script réveille le service, rejoue le parcours de démonstration avec un compte jetable, puis le supprime.

## Commandes

| Commande                                                        | Rôle                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm test`                                                      | Tous les tests. Une base MongoDB éphémère est téléchargée au premier lancement. |
| `npm run lint` · `npm run typecheck` · `npm run format:check`   | Qualité                                                                         |
| `npm run build:api` · `npm run build:web -w @subtracker/mobile` | Builds de production                                                            |
| `npm run openapi`                                               | Écrit la spécification dans `apps/api/openapi.json`                             |

Les tests d'intégration appellent l'application Express avec Supertest, sur une base de test isolée. `apps/api/test/requirements.test.ts` couvre le parcours CRUD, les entrées invalides (400), l'accès sans JWT valide (401) et l'isolation entre deux comptes (404). Pour cibler un test : `npm test -w @subtracker/api -- test/requirements.test.ts -t "isolation"`.

## Architecture

```
apps/api            API Express : un module par domaine (auth, subscriptions, detection, bank,
                    powens, webhooks…), découpé en routes → service → modèles Mongoose
apps/mobile         Application Expo Router : src/app (écrans), src/features, src/components, src/lib
packages/contracts  Schémas Zod partagés : types de l'app et de l'API, validation, OpenAPI
packages/detection  Moteur de détection pur, sans I/O ni dépendance à Powens
```

## Limites connues

- Détection des abonnements mensuels uniquement, par des règles explicables. Le score de confiance est plafonné à 95 %.
- Une seule connexion bancaire par utilisateur. Seuls les débits des comptes choisis sont importés ; aucun identifiant bancaire n'est stocké.
- L'intégration Powens n'est validée que sur des réponses simulées.
- La résiliation n'est jamais automatique. 9 des 29 procédures du catalogue ont été vérifiées sur les pages officielles ; les autres sont signalées « non vérifiées ».
- En production web, l'API et l'app doivent être sur le même site, car le refresh token voyage dans un cookie `SameSite=Strict`.
- iOS n'a pas été testé.
