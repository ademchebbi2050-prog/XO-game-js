# Clone Converty — guide de lancement (Windows, from scratch)

## 🚀 Méthode la plus simple (une seule action)

Après avoir cloné le dépôt et installé Node.js ≥ 22.18 :

```powershell
cd $env:USERPROFILE\XO-game-js\clone   # ou le dossier où TU as cloné le dépôt
# double-clic sur start.cmd, OU :
node scripts/run-all.mjs
```

**Une seule fenêtre, une seule commande** : le script fait tout dans un seul processus —
vérifie Node, crée `.env`, installe les dépendances si besoin, vérifie le fichier `hosts`,
démarre la base PGlite **dans le même terminal**, applique le schéma + le seed + le RLS,
build si besoin, lance le serveur Next, puis affiche le diagnostic `check.mjs`. Arrêt : `Ctrl+C`. Si le port 5433 est bloqué par un vieux processus, le script l'indique (`taskkill /PID <pid> /F`) et il suffit de relancer. Puis :

- Dashboard : http://app.localhost:3000/app/login (demo@exemple.tn / demo1234)
- Boutiques : http://boutique-a.localhost:3000/ et http://boutique-b.localhost:3000/

> Le fichier `hosts` reste la seule étape manuelle : en admin,
> `notepad C:\Windows\System32\drivers\etc\hosts` → ajouter
> `127.0.0.1 app.localhost boutique-a.localhost boutique-b.localhost`

## Guide détaillé pas à pas

Application e-commerce « paiement à la livraison » (COD) pour la Tunisie :
Next.js 15 + TypeScript + Tailwind 4 + Prisma (client WASM, aucun binaire Rust)
+ PGlite (Postgres embarqué, aucune installation de Postgres requise) + NextAuth v5.
Boutiques sur sous-domaines (`<slug>.localhost:3000`), dashboard sur `app.localhost:3000`, FR + AR (RTL).

## 1. Prérequis à installer

| Outil | Version requise | Où |
|---|---|---|
| Node.js | **≥ 22.18.0** (recommandé : la dernière LTS 22.x, ex. 22.20.x) | https://nodejs.org (choisir « LTS ») |
| Git | n'importe quelle version récente | https://git-scm.com/download/win |
| Windows 10/11 | — | — |

Vérifier dans un terminal (PowerShell ou cmd) :

```powershell
node -v        # doit afficher v22.x (≥ 22.18)
npm -v
git --version
```

**Aucun serveur Postgres à installer** : en local, la base est un vrai Postgres WASM (PGlite)
lancé par un script du projet (voir étape 4).

## 2. Récupérer le code

> **Windows PowerShell 5.1 ne connaît pas `&&`** : séparateur `;` ou commandes sur
> des lignes séparées. Ne lance jamais `npm install` hors du dossier `clone\`.

```powershell
git clone https://github.com/ademchebbi2050-prog/XO-game-js.git
cd XO-game-js
git checkout arena/b7a40c52-xo-game-js
cd clone
```

Si le dossier `XO-game-js` existe déjà (clone précédent) :
```powershell
cd XO-game-js
git fetch origin
git checkout arena/b7a40c52-xo-game-js
git pull origin arena/b7a40c52-xo-game-js
cd clone
```

## 3. Créer le fichier `.env` (obligatoire, AVANT le npm install)

```powershell
Copy-Item .env.example .env
```

(En cmd : `copy .env.example .env`)

Contenu de `.env` (déjà prêt dans `.env.example`) :

```dotenv
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres"
AUTH_SECRET="change-me-dev-only"
NEXT_PUBLIC_ROOT_DOMAIN="localhost:3000"
PRISMA_CLIENT_ENGINE_TYPE="client"
```

- `PRISMA_CLIENT_ENGINE_TYPE="client"` est **indispensable** : il est lu par le `prisma generate`
  du postinstall et fait générer un client Prisma 100 % WASM (sans téléchargement de binaire Rust).
- Changez `AUTH_SECRET` par une valeur longue et aléatoire si vous déployez un jour en ligne.
- En production (HTTPS), pointez `DATABASE_URL` vers Neon (commenté dans `.env.example`) et
  décommentez `COOKIE_SECURE="true"`.

## 4. Installer les dépendances

```powershell
npm install
```

Le `postinstall` exécute `prisma generate` (client WASM) puis `scripts/patch-prisma-wasm.mjs`.
Si Windows bloque l'exécution de scripts : `Set-ExecutionPolicy -Scope Process RemoteSigned`.

## 5. Ajouter les sous-domaines locaux (fichier hosts)

Ouvrir le Bloc-notes **en tant qu'administrateur**, ouvrir :

```
C:\Windows\System32\drivers\etc\hosts
```

et ajouter à la fin :

```
127.0.0.1 app.localhost boutique-a.localhost boutique-b.localhost
```

Sauvegarder. (Sans cette étape, seules les URLs en `localhost:3000` fonctionneraient.)

## 6. Lancer la base de données locale (terminal 1)

```powershell
npm run db:up
```

→ affiche `PGlite socket server on 127.0.0.1:5433`. Laisser ce terminal ouvert.
Données persistées dans `%USERPROFILE%\.pglite-data` (ex. `C:\Users\SPIRIT\.pglite-data`).

**La toute première fois uniquement**, initialiser le schéma et les données de démo :

```powershell
npm run db:setup
```

→ crée les 15 tables + la vue, puis seed : compte `demo@exemple.tn` / mot de passe `demo1234`,
boutiques `boutique-a` et `boutique-b`, 1 produit démo, tarifs de livraison (Tunis 5,000 TND, ailleurs 7,000 TND),
transporteurs simulés `sim-standard` / `sim-express`.

## 7. Compiler et lancer l'application (terminal 2)

```powershell
npm run build
npx next start -p 3000 -H 0.0.0.0
```

→ `Ready` sur le port 3000. Laisser ce terminal ouvert.
(En développement, on peut remplacer les deux commandes par `npm run dev`.)

## 8. Ouvrir dans le navigateur

| URL | Rôle |
|---|---|
| http://app.localhost:3000/app/login | **Dashboard** — connexion : `demo@exemple.tn` / `demo1234` |
| http://boutique-a.localhost:3000/ | **Boutique A** (storefront client, FR par défaut) |
| http://boutique-b.localhost:3000/ | **Boutique B** (isolation des données vérifiée) |
| http://localhost:3000/ | redirige vers le dashboard (`/app/login`) |

- Changer de langue FR ↔ AR : sélecteur de langue en haut des pages (l'AR passe la page en RTL).
- Suivi de commande client (ex. `CMD-000001`) : http://boutique-a.localhost:3000/order/CMD-000001
  ou API `GET /api/public/orders/CMD-000001?phone=+216XXXXXXXX&slug=boutique-a`.

## 9. Dépannage rapide

- `node -v` < 22.18 → les scripts (`seed.mjs` importe un `.ts`) échouent : mettre à jour Node.js.
- Erreur Prisma « could not locate the Query Engine » → `PRISMA_CLIENT_ENGINE_TYPE="client"`
  manque dans `.env` **ou** le `.env` a été créé après `npm install` : supprimer `node_modules`
  et `src\generated`, puis relancer `npm install`.
- Port 3000 occupé → lancer `npx next start -p 3001 -H 0.0.0.0` et remplacer `3000` par `3001`
  dans les URLs et dans `NEXT_PUBLIC_ROOT_DOMAIN`.
- Le `npm run db:up` indique « port 5433 déjà utilisé » → la base tourne déjà, passer à l'étape 7.
- Réinitialiser la base : supprimer le dossier `%USERPROFILE%\.pglite-data`, relancer `npm run db:up` puis `npm run db:setup`.

## Commandes récapitulatives (PowerShell)

```powershell
git clone https://github.com/ademchebbi2050-prog/XO-game-js.git; cd XO-game-js; git checkout arena/b7a40c52-xo-game-js; cd clone
Copy-Item .env.example .env          # à faire AVANT npm install
npm install                          # terminal courant
# hosts: ajouter  127.0.0.1 app.localhost boutique-a.localhost boutique-b.localhost
# terminal 1:
npm run db:up                        # laisser ouvert
npm run db:setup                     # première fois seulement
# Optionnel (M4, recommandé): active le RLS Postgres (défense en profondeur)
node scripts/enable-rls.mjs
# terminal 2:
npm run build
npx next start -p 3000 -H 0.0.0.0     # laisser ouvert
# tests d'isolation + preuve RLS (serveur lancé):
node tests/isolation/run.mjs         # 20/20 PASS attendus
# navigateur:
#   http://app.localhost:3000/app/login   (demo@exemple.tn / demo1234)
#   http://boutique-a.localhost:3000/
```

## M5 — fonctionnalités avancées (2026-11-05)

- **Paiement carte (PSP simulé « SimPSP »)** : au checkout, choisir « Carte bancaire » → hosted-checkout `/pay/<PSP-…>` (boutons Payer/Refuser en démo) → webhook signé HMAC `/api/webhooks/psp` (idempotent) → remboursement possible depuis le détail commande. En prod : remplacer SimPSP par Flouci/Paymee/CIB (même contrat). Secret : `SIMPSP_WEBHOOK_SECRET` dans `.env`.
- **Variantes de produits** : taille/couleur avec stock et delta de prix propres (éditeur dans Produits), prix = base + delta, stock décrémenté sur la variante, snapshot en commande.
- **Thèmes no-code** : 4 presets + couleurs libres dans Réglages → Apparence, appliqués en direct à ta boutique (sous-domaine) via variables CSS.
- **Notifications push** : page `/app/notifications` — activer (simulé en local, Web Push VAPID en prod), chaque changement de statut de commande émet une notification (outbox consultable).
- **Commission plateforme** : `commissionBps` dans Réglages (500 = 5 % par défaut), cartes Commission / CA net au dashboard.

Tests : `node tests/e2e/run.mjs` → F01–F11 (57 contrôles, HTTP réel). Migration M5 auto au lancement (`scripts/run-all.mjs` appelle `scripts/migrate-m5.mjs`).
