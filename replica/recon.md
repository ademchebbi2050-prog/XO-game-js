# Recon map: Converty (converty.shop) — web SaaS

Scope: le cœur de métier de Converty — créer une boutique en ligne no-code, gérer produits/stocks/commandes (OMS) avec paiement à la livraison (COD), livraison intégrée aux transporteurs locaux, statistiques temps réel — côté commerçant (dashboard web partner.converty.shop + apps iOS/Android) et côté acheteur (boutique générée). La partie "création de landing page IA / chatbot IA" est listée mais traitée comme feature différenciante, pas comme cœur.
For: un produit à vendre — clone destiné aux commerçants des marchés COD (Tunisie d'abord, puis DZ/LY et autres marchés émergents), en concurrence frontale sur le critère "gratuit jusqu'à 10 000 TND de ventes, puis 0,3 %".
Date: 2026-11-03

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | landing page FR | https://converty.shop/fr | pitch, 4 étapes, thèmes, pricing (gratuit jusqu'à ~3 000 $ / 10 000 TND, puis 0,3 %), FAQ, support WhatsApp +216 48 272 872 |
| 2 | sitemap | https://converty.shop/sitemap.xml | locales fr/en/ar, blog, about, terms, privacy, payment-policy |
| 3 | blog comparatif Converty vs Shopify vs WooCommerce | https://converty.shop/fr/blog/meilleure-plateforme-e-commerce-en-tunisie-converty-vs-shopify-vs-woo-commerce | liste de features: OMS, COD natif, IA (chatbot, extraction de commandes, générateur de landing), anti-fraude (vérif téléphone, IP blocker, restrictions pays) |
| 4 | blog guide e-commerce Tunisie 2026 | https://converty.shop/en/blog/e-commerce-in-tunisia-the-complete-guide-2026-2 | transporteurs TN cités (First Delivery, Aramex TN...), COD reconciliation depuis un seul dashboard |
| 5 | CGU | https://converty.shop/fr/terms | pricing détaillé: 0,3 % après 10 000 TND; abonnement fixe dès 90 000 TND/30 j, à partir de 99 $/mois. Aucun clause interdisant d'utiliser son propre compte pour étudier le produit concurrentiel — on reste néanmoins sur sources publiques uniquement |
| 6 | App Store TN (fiche + historique des versions) | https://apps.apple.com/tn/app/converty-shop/id6466304252?l=fr-FR | 4,7★ (18 notes), changelog = mine de features: dispatching commandes vers équipe de confirmation, promo codes, échanges liés, prédiction IA de fiabilité client, variantes/bundles, scanner code-barres, multi-store, WhatsApp redirect, pièces jointes, replanification |
| 7 | Google Play | https://play.google.com/store/apps/details?id=com.converty.app&hl=fr&gl=TN | 4,5★ (58 avis), 10 k+ téléchargements, 20+ langues, détails colis |
| 8 | entrée app commerçant | https://partner.converty.shop/dashboard (signup/login) | le dashboard vit sur un sous-domaine séparé |
| 9 | comparatif tiers | https://medicane.co/blog/shopify-vs-converty-tunisie | COD > 70 % des transactions en TN; paiements locaux Flouci, Paymee, cartes CIB |

Note: aucune capture d'écran prise (pas de compte utilisateur fourni). `replica/screens/` recevra les captures de référence prises depuis les pages publiques et/ou le compte propre de l'utilisateur.

## Core loop

Le commerçant crée sa boutique en < 30 min sans code (thème + éditeur visuel + sous-domaine gratuit), publie un catalogue, et chaque commande entrante (Facebook/Instagram/manual/web) passe par un workflow OMS centralisé — réception → confirmation téléphonique → préparation → expédition via transporteur intégré → livraison/retour avec réconciliation COD — le tout suivi en temps réel depuis le dashboard web ou l'app mobile, avec stats et calculateur de rentabilité.

## Screens

Surface A — dashboard commerçant (web, partner.converty.shop). Routes inférées (derrière login), à confirmer avec le compte propre :

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Login | /login | auth (email+mdp, session persistante) | input, button, error toast | empty, error, loading |
| S02 | Signup | /signup?q=... | création de compte (source tracking) | form multi-étapes, password required | empty, validation errors |
| S03 | Onboarding wizard | 1ère connexion | 4 étapes: compte → designer la boutique → produits/ventes → résultats | stepper | incomplete/complete |
| S04 | Dashboard home | /dashboard | stats temps réel: revenus, commandes, visiteurs, taux de conversion | charts, KPI cards, activity feed, bell notifications | loading, empty (nouveau), filled |
| S05 | Produits (liste) | /products | catalogue, recherche, filtres, badges stock | data table, search, filters, badges | empty, low stock, out of stock |
| S06 | Fiche produit | /products/:id | images, prix, coût, variantes, bundles, code-barres, stock | image uploader, variant editor, barcode field, stock input | new, edit, saved |
| S07 | Commandes (liste) | /orders | toutes les commandes, filtres statut, recherche client/téléphone/n° commande, badges (repeat buyer, statut) | data table, status pills, search, swipe cards (mobile) | empty, loading, filtered |
| S08 | Détail commande | /orders/:id | cycle de vie, édition, pièces jointes, promo, échange lié, replanification + date de suivi, score de fiabilité client, redirect WhatsApp | status timeline, actions, attachments, score badge | chaque statut, édition, erreur |
| S09 | Nouvelle commande | /orders/new | saisie manuelle + "AI Extract" (upload capture d'écran FB/IG → extraction auto des infos client) | form, image upload, AI fill | empty, extracting, error |
| S10 | Dispatching | /dispatching | assigner les nouvelles commandes aux agents de confirmation, suivre la file en live | queue board, assign dropdown | empty, in progress |
| S11 | Clients | /customers | liste clients, score de fiabilité (taux livraison/confirmation), récap commandes | table, score badge, repeat badge | empty, filled |
| S12 | Livraison | /delivery | transporteurs connectés, presets par pays (TN/DZ/LY), choix méthode + prix par commande, tracking temps réel, étiquettes | carrier cards, preset select, tracking timeline, print | no carrier, pending, in transit, delivered, returned |
| S13 | Analytics + calculateur de rentabilité | /stats | rapports temps réel + profit estimé par unité (coût livraison, coût lead pub, taux de confirmation) | charts, calculator form | loading, empty, filled |
| S14 | Éditeur de boutique | /store/editor | choix du thème (Paris, Oslo, Amsterdam, Dakar, Tokyo, Nairobi, Berlin...) + éditeur visuel no-code | theme picker grid, visual editor | preview, saved, published |
| S15 | Paramètres | /settings | domaine perso + sous-domaine gratuit, paiements (COD / carte, PSP locaux), intégrations (Facebook, GA, Search Console, Google Sheets), équipe & rôles, notifications, sécurité (IP blocker, restrictions pays), champs checkout personnalisés | tabs, toggles, integration cards, role manager | connected/disconnected, error |
| S16 | Facturation | /billing | commission 0,3 % au-delà de 10 000 TND, option abonnement fixe (dès 90 000 TND/30 j, à partir de 99 $/mois), factures conformes fiscalité TN | plan cards, invoice list, download | free tier, commission tier, subscription |
| S17 | Activité équipe | /activity | fil d'activité filtré (team activities) | feed, filters | empty, filled |
| S18 | Support | lien WhatsApp/email | aide 7j/7 09:00–00:00 | external link | — |

Surface B — boutique générée (sous-domaine *.converty.shop ou domaine perso) :

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S19 | Accueil boutique | / | vitrine, bannières, mise en avant | hero, product grid, nav, footer | loading, empty catalog |
| S20 | Catalogue / catégorie | /category/:slug | liste produits filtrables | grid, filters, pagination | empty, filtered |
| S21 | Page produit | /product/:slug | images, prix, variantes, stock, ajout panier | gallery, variant picker, add-to-cart, stock badge | out of stock, variants |
| S22 | Panier | /cart | lignes, quantités, total, promo | cart lines, qty stepper, promo input, total | empty, promo invalid |
| S23 | Checkout | /checkout | coordonnées, adresse/gouvernorat, méthode de livraison + prix, paiement (COD ou carte), champs perso, code promo | multi-step form, delivery select w/ price, payment toggle | validation errors, delivery unavailable, payment error |
| S24 | Confirmation / suivi commande | /order/:id ou lien SMS | confirmation + suivi statut livraison | confirmation, tracking timeline, WhatsApp contact | confirmed, shipped, delivered, returned |

Surface C — app mobile (iOS/Android) : miroir du dashboard (S04, S05–S08, S12, S13) + natif: scanner code-barres, notifications push, multi-store switcher, cartes de commande "swipeables". Écran S25 = shell mobile.

## Flows

```
F01 Commerçant lance sa boutique
    S02 signup -> S03 onboarding -> S14 choix thème + édition -> S06 ajout produits
    -> S15 domaine/paiement/transporteur -> publication (S19 live)
    happy path clicks: ~10-15 écrans
    edge: domaine déjà pris, paiement non configuré, aucun transporteur connecté

F02 Acheteur commande en COD (boucle payante côté commerçant)
    S19 -> S20 -> S21 -> S22 -> S23 (tel + adresse + livraison + COD) -> S24
    happy path clicks: 5 écrans, ~8 champs
    edge: rupture de stock, gouvernorat non livré, promo invalide, téléphone invalide,
          double submit, paiement en ligne refusé

F03 Cycle de vie d'une commande (côté commerçant)
    notif push -> S07 -> S10 dispatch agent -> appel confirmation -> S08
    statuts: new -> confirmed -> preparing -> shipped -> delivered | returned | cancelled
    S12 choix transporteur + étiquette -> tracking temps réel -> S16 réconciliation COD
    edge: pas de réponse (replanifier + date de suivi), échange (commande liée),
          annulation, litige, score fiabilité client faible

F04 Saisie manuelle d'une commande avec AI Extract
    S09 -> upload capture (FB/IG) -> extraction IA champs client -> validation -> save -> S07
    edge: extraction erronée, doublon détecté

F05 Gestion du stock
    S06 édition stock/variantes/bundles/code-barres ; scan code-barres (mobile S25)
    alertes stock faible ; oversell bloqué (inventaire temps réel)
    edge: stock négatif, bundle décompose le stock des composants

F06 Pilotage par les chiffres
    S04/S13 stats temps réel (revenus, commandes, visiteurs, conversion, taux de retour)
    + calculateur de rentabilité par unité (coût livraison + coût lead + taux confirmation)
    edge: aucune donnée (boutique neuve)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, hover, focus, disabled, loading | all |
| Input / Select / Textarea | text, phone, number, search | empty, focus, error, disabled, filled | S02, S06, S08, S09, S23 |
| Data table | orders, products, customers | sort, filter, search, pagination, row actions | S05, S07, S11 |
| Status pill / badge | order status, repeat buyer, reliability score, stock | color-coded variants | S04-S08, S11, S21 |
| Status timeline / stepper | order lifecycle, onboarding | current, done, pending | S03, S08, S24 |
| Modal / Drawer | quick view, confirm dialogs, order drawer | open, close, loading | S07, S08 |
| Toast / Snackbar | success, error, info | auto-dismiss | all |
| KPI card + charts | line, bar, donut | loading, empty, filled | S04, S13 |
| Image uploader | single, multi, with AI extract | empty, uploading, preview, error | S06, S09 |
| Variant editor | options (taille, couleur...), combos, bundle | add/remove, stock per variant | S06 |
| Theme picker grid | 7+ thèmes nommés | preview, selected, published | S14 |
| Barcode scanner | camera overlay | scanning, result, error | S25 (mobile), S06 |
| Notification bell + push | in-app list, push mobile | unread badge, read | S04, S25 |
| Promo input | text + apply | valid, invalid, expired | S22, S23, S08 |
| Nav / sidebar (dashboard) | collapsible, store switcher | collapsed, expanded, multi-store | all dashboard |
| RTL layout + i18n (fr/ar/en, 20+ langues) | direction switch | ltr/rtl | all |

## Inferred data model

```
User          id, email, password_hash, phone, role (owner | confirmation_agent), name
              evidence: S01/S02 login, dispatching agents S10, multi-store S25
              confidence: high
Store         id, owner_id, subdomain, custom_domain, theme_id, currency (TND default),
              country, status (draft|published), plan (free_tier|commission|subscription),
              settings json (payments, integrations, checkout fields, security rules)
              evidence: S14/S15/S16, FAQ "sous-domaine gratuit + domaine perso", CGU pricing
              confidence: high
Membership    user_id, store_id, role        (multi-store switcher, v2.3.0)
              confidence: high
Theme         id, name (Paris, Oslo...), layout json, is_active
              evidence: landing "Templates" carousel; designs propres = HORS scope (on rebuild des thèmes propres)
              confidence: high (existence), guess (structure)
Product       id, store_id, title, description, price, cost, images[], barcode,
              stock_qty, is_bundle, variants json, category_id, status
              evidence: S05/S06, changelog "variants and bundles", "barcode management"
              confidence: high
Category      id, store_id, name, slug
              confidence: medium (catalog S20)
Order         id, store_id, number, customer_name, customer_phone, address, governorate,
              items json (product_id, variant, qty, price), status (new|confirmed|preparing|
              shipped|delivered|returned|cancelled), payment_method (cod|card), payment_status,
              carrier_id, tracking_number, promo_code, discount, total, cost,
              reliability_score (predicted), attachments[], follow_up_at, exchange_of_order_id,
              source (web|facebook|instagram|manual), created_at
              evidence: S07/S08/S09, changelog (dispatching, promo, exchange, reschedule, attachments,
              AI reliability), blog (COD reconciliation, return rate)
              confidence: high
Customer      id, store_id, phone (unique per store), name, reliability_score,
              orders_count, repeat_badge
              evidence: S11, changelog "live customer reliability scores", "repeat buyer badges"
              confidence: high
Carrier       id, store_id, name, country, preset json (prix par gouvernorat/zones),
              api_config, is_active
              evidence: S12, landing "intégrations sociétés de livraison TN", changelog "delivery presets LY/DZ"
              confidence: high
Shipment      id, order_id, carrier_id, tracking_number, status, events json, label_url
              confidence: medium-high
PromoCode     id, store_id, code, type (percent|fixed), value, usage_limit, expires_at, is_active
              evidence: changelog v2.5.7 "promo codes and coupons on orders"
              confidence: high
Cart          id (session), store_id, items json, promo_code, totals   (storefront, pre-order)
              confidence: medium
Notification  id, store_id, user_id, type, payload, read_at, push_sent
              confidence: high
ActivityLog   id, store_id, actor_id, action, target, created_at   ("team activities", feed filters)
              confidence: medium-high
Invoice       id, store_id, order_id(s), number, fiscal fields (TN), pdf_url, issued_at
              evidence: landing "facturation conforme aux exigences fiscales locales"
              confidence: medium
Integration   id, store_id, provider (facebook_pixel|ga|gsc|sheets|whatsapp), config json, connected
              evidence: landing "Facebook, Google Analytics, Search Console, Google Sheets"
              confidence: high

Relationships: User 1-n Membership n-1 Store; Store 1-n Product/Category/Order/Customer/
Carrier/PromoCode/Integration/Invoice; Product 1-n OrderItem (via Order.items); Order 1-1 Shipment;
Order n-1 Customer (by phone); Order self-ref exchange_of_order_id; Store 1-n Theme via theme_id.
```

## Feature matrix

See `features.csv`. Must: voir fichier, should: voir fichier, could: voir fichier, skip: marque/thèmes propres, réseau transporteurs & contrats, données clients, modèles IA entraînés, service humain (experts Meta Ads, support), présence App Store/Play, licences PSP.

## Out of scope (cannot or should not be cloned)

- **Marque et contenus propriétaires** : nom, logo, copy du site, designs des thèmes (Paris, Oslo...), captures marketing — on rebuild des thèmes propres, clean-room.
- **Le réseau** : contrats avec les transporteurs (First Delivery, Aramex TN...), la base de commerçants/clients, la communauté — ce sont leurs actifs, pas des features. On construit une couche d'intégration transporteur générique (API publiques des transporteurs ou saisie manuelle + tracking générique).
- **Les modèles IA entraînés** (extraction de commandes, prédiction de fiabilité) : on réimplémente la fonctionnalité avec nos propres règles/modèles, pas leurs poids.
- **Services humains** : support 7j/7, experts Meta Ads, configuration offerte de la boutique.
- **Licences et conformité** : licences PSP (Flouci, Paymee, e-Dinar...), agréments, entité légale — on s'appuie sur des PSP licenciés existants.
- **Présence store** : fiches App Store / Google Play propres à l'app originale.

## Size

Screens 25 (18 dashboard + 6 boutique + shell mobile), flows 6, entités ~15.
Hard parts: (1) temps réel (websockets: nouvelles commandes, file de dispatching, tracking) + notifications push; (2) paiement COD + réconciliation avec transporteurs et PSP carte; (3) multi-store + rôles/permissions (owner vs agents de confirmation); (4) features IA (extraction commande depuis capture, score de fiabilité client); (5) i18n/RTL (fr/ar + 20 langues); (6) inventaire temps réel anti-oversell avec variantes/bundles.
Size: **L** (un trimestre) pour le cœur web (dashboard OMS + boutique + COD + stats). **XL** si on ajoute les apps mobiles natives + l'IA. Rescope conseillé: MVP = F01+F02+F03+F05 sur web, COD + 1-2 transporteurs en saisie manuelle, stats de base.
