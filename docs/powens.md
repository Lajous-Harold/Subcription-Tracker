# Connexion bancaire (Powens) et Android

L'application fonctionne sans banque connectée : les données de démonstration suffisent pour essayer la détection. Ce document ne sert que pour brancher une vraie connexion bancaire.

## Configurer la sandbox Powens

1. Sur la console Powens, créer le compte, l'organisation, puis un domaine sandbox (`<projet>-sandbox.biapi.pro`).
2. Dans **Client Applications** > **Add a client**, mettre en liste blanche ces URL de redirection :
   - `subtracker://powens/callback` (APK Android) ;
   - `https://<service>.onrender.com/powens/callback` (app web en ligne, servie par l'API) ;
   - `http://localhost:4000/powens/callback` (app web servie par Docker en local) ;
   - `http://localhost:8081/powens/callback` (app web en développement, Metro).

   L'API choisit seule l'URL de retour web : `<URL publique>/powens/callback` quand elle sert l'app web, `localhost:8081` sinon. `POWENS_REDIRECT_URI_WEB` force une autre valeur.

3. Renseigner `POWENS_DOMAIN`, `POWENS_CLIENT_ID` et `POWENS_CLIENT_SECRET` dans `apps/api/.env`.
4. Vérifier la configuration avec `npm run powens:smoke -w @subtracker/api`. Le script crée un utilisateur temporaire, affiche l'URL de la Webview, lit les comptes, puis supprime l'utilisateur.
5. Webhooks (facultatifs, la synchronisation fonctionne aussi sans) :
   - créer une URL par événement, par exemple `https://<api>/api/webhooks/powens/CONNECTION_SYNCED`, et de même pour `CONNECTION_DELETED` et `USER_DELETED` ;
   - créer le fournisseur d'authentification HMAC, puis copier aussitôt sa clé dans `POWENS_WEBHOOK_SECRET` : elle ne s'affiche qu'une fois ;
   - en local, exposer l'API par un tunnel (`cloudflared tunnel --url http://localhost:4000` ou ngrok) et renseigner son URL dans `PUBLIC_API_URL`.
6. Tester le parcours avec le **Connecteur de test** : identifiant libre, mot de passe `1234`.

### À vérifier au premier essai réel

L'intégration n'a été validée que sur des réponses simulées. Ces points ne sont pas précisés par la documentation Powens consultée :

- Powens accepte-t-il `http://localhost` comme URL de redirection ? Sinon, passer par un tunnel HTTPS.
- Le format exact de l'« endpoint » dans la signature des webhooks. L'API accepte le chemin seul ou l'URL complète.
- Le contenu du payload `CONNECTION_SYNCED`. L'API ne s'en sert que pour identifier l'utilisateur, puis relit tout.
- Le jeton requis pour créer le fournisseur HMAC (`POST /webhooks/auth`).
- Le connecteur de test produit-il des prélèvements mensuels ? Sinon, montrer la détection avec les données de démonstration.
- Le type Powens d'un prélèvement SEPA (`order` supposé), réglable dans `packages/detection/src/engine.ts`.

## Android

| Besoin                                           | Commande                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Tout sauf la connexion bancaire                  | `npm run dev:mobile`, puis scanner le QR code avec Expo Go                            |
| Parcours bancaire (lien profond `subtracker://`) | `cd apps/mobile && npx eas-cli@latest build --profile development --platform android` |
| APK de démonstration                             | `cd apps/mobile && npx eas-cli@latest build --profile preview --platform android`     |

Expo Go ne permet pas le parcours bancaire : son URL de retour `exp://<ip>` change avec le réseau, et Powens ne peut pas la mettre en liste blanche.

Adresse de l'API vue par l'app (`EXPO_PUBLIC_API_URL` dans `apps/mobile/.env`) :

- émulateur : `http://10.0.2.2:4000/api` ;
- téléphone physique : `http://<IP-du-PC>:4000/api`, sur le même réseau Wi-Fi.
