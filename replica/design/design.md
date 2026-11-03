# Design system — clone COD (identité originale "Terre & Encre")

Date: 2026-11-03 · Source: `replica/recon.md`, périmètre validé dans `replica/architecture.md` (boucle COD web uniquement).
Fichiers: `tokens.json` (rôles), `tokens.css` (custom properties), `tailwind-theme.css` (mapping Tailwind v4), `components.md` (specs), `contrast-report.txt` (WCAG).

**Règle d'originalité**: on ne reprend AUCUN asset de Converty — ni logo, ni couleurs (leur violet est exclu; notre accent est un terracotta profond), ni textes (toutes les copies sont rédigées à neuf), ni polices sous licence. Icônes: Lucide (ISC). Polices: Manrope + Tajawal (OFL). Le nom/logo définitifs arrivent avec `/replica-brand`; ici c'est un placeholder.

## 1. Identité visuelle (propre)

- **Palette "Terre & Encre"**: fond sable `#FBF7F1`, surfaces blanches, encre chaude `#221D16` pour le texte, **accent terracotta `#A83E14`** (boutons primaires, focus, liens) — choix délibérément différent de l'original, chaleureux, crédible pour le commerce en Tunisie.
- **Sémantique**: danger `#B3261E`, succès/livré `#1E7A3C`, warning/à confirmer `#8A5A00`; **8 statuts de commande** chacun avec une paire texte/fond pastel (`status-*` / `status-*-soft`), toutes vérifiées AA.
- **Greys réels**: 5 niveaux (bg, surface, surface-subtle, border, border-input) + texte + muted — pas plus.
- **Typographie**: échelle 12/14/16/20/28/40 (lignes 16/20/24/28/34/44), graisses 400–800. Police latine **Manrope** (géométrique, lisible en petit), arabe **Tajawal** (excellent rendu arabe, inclut le latin). Chargement `next/font/google`, subsets `latin` + `arabic`, `display: swap`; `fr → font-sans`, `ar → font-arabic`.
- **Rayons**: 6/10/16 + pill. **Ombres**: `card` (léger) et `pop` (modales). **Motion**: 120/200ms, ease `cubic-bezier(.2,.8,.2,1)`, désactivée si `prefers-reduced-motion`.

## 2. FR + AR, RTL dès le départ

- `dir` posé sur `<html>` par locale (`fr`=ltr, `ar`=rtl, via next-intl) — jamais de détection JS custom.
- **Zéro `left/right` en dur**: uniquement les utilitaires logiques Tailwind v4 `ms-/me-/ps-/pe-/start-/end-/text-start/text-end`, `border-s`, `rounded-s-*`, etc.
- Icônes directionnelles (chevrons, flèches, Précédent/Suivant): classe `.flip-rtl`, retournée par `[dir=rtl] .flip-rtl { transform: scaleX(-1) }`.
- Îlots LTR: `.ltr-island { direction:ltr; unicode-bidi:plaintext }` sur téléphones `+216…`, numéros `CMD-…`, tracking, et montants si besoin.
- Espacements/paddings miroirs automatiques grâce aux propriétés logiques; chaque écran testé en **fr-LTR et ar-RTL**.

## 3. Layout (mobile-first, deux surfaces)

| surface | mobile (< lg) | desktop (≥ lg) |
| --- | --- | --- |
| Dashboard `app.<domaine>` | bottom tab bar 56px (Accueil, Commandes+badge, Produits, Livraison, Réglages), header 56px, contenu pleine largeur avec `p-4` | sidebar 240px, header 56px, contenu max-w 1200px centré |
| Boutique `<slug>.<domaine>` | colonne unique max-w 680px, CTA "Commander" **sticky en bas**, grille produits 2 col | grille 3–4 col, récap latérale au checkout ≥ md |

- Liste des commandes: **cartes en mobile, tableau en ≥ lg** (même composant, rendu adaptatif).
- Cibles tactiles ≥ 44px partout (boutons md = 44px de haut).

## 4. Écrans dans le périmètre (avec notes de layout)

| écran | contenu clé |
| --- | --- |
| S01/S02 login, signup | carte centrée max-w 400px, PhoneInput +216, lien switch FR/AR |
| S03 onboarding | stepper 4 étapes, choix slug (aperçu `<slug>.<domaine>`), CTA primaire pleine largeur |
| S04 dashboard | 4 KPI (2 col mobile), chart SVG, liste 5 dernières commandes, EmptyState si vide |
| S05/S06 produits | liste cartes mobile / table lg; fiche produit: ImageUploader (max 8, 5 Mo), prix en millimes, stock, catégorie |
| S07 commandes | recherche + filtres statut (chips), OrderCard mobile / DataTable lg |
| S08 détail commande | StatusPill + **Timeline** (statuts + appels), ActionBar: **Appeler (tel:)**, **WhatsApp (wa.me)**, boutons de transition de statut (bottom sheet mobile), édition inline |
| S12 livraison | tarifs par gouvernorat (24 lignes éditables), choix transporteur à l'expédition, tracking en `.ltr-island` |
| S15 réglages | onglets: boutique, domaine, livraison, numéros bloqués, équipe (plus tard) |
| S19–S21 boutique publique | home (hero léger + produits), catégorie, fiche produit avec stock |
| S22/S23 panier/checkout | récap sticky, **formulaire très court**: téléphone, nom, gouvernorat, adresse, livraison (prix), COD — 6 champs max |
| S24 suivi commande | n° + téléphone → timeline publique (données masquées) |

## 5. Contraste WCAG (rapport officiel)

`python3 .claude/skills/replica-design/contrast.py replica/design/tokens.json` → **36 paires, 0 échec AA** (exit 0), dont toutes les paires texte/fond, `text-muted` sur les 3 fonds, `on-accent` sur `accent` (6.24:1), les 8 statuts, danger/success/warning, et les paires "ui" (focus ring accent ≥ 3:1 = 5.85:1, bordure input ≥ 3:1 = 3.90:1). Rapport complet: `contrast-report.txt`. Toute nouvelle paire ajoutée plus tard doit repasser ce script (il échoue au build sinon).

## 6. Intégration Tailwind

Tailwind **v4** (CSS-first): un fichier racine importe `tailwindcss`, `tokens.css`, `tailwind-theme.css`. Le bloc `@theme inline` mappe chaque token: couleurs → `bg-surface`, `text-muted`, `bg-status-to-confirm-soft text-status-to-confirm`, typo → `text-sm`…, rayons → `rounded-md`, ombres → `shadow-card`, motion → `duration-base ease-brand`. **Jamais de hex en dur dans les composants.** Espacement: grille 4px native de Tailwind = `tokens.space`; valeurs arbitraires interdites.

## 7. Performance (boutique publique légère)

- Budget: JS initial boutique < 120 Ko gzip, LCP < 2,5 s, CLS < 0,1; images webp redimensionnées 1600px (architecture §6), `loading="lazy"`, polices subset latin+arabic.
- Zéro lib de charts/animation côté boutique (SVG maison); dashboard idem pour rester léger.
- Pas de cookie de session côté boutique (architecture §2) → cacheable.

## 8. Hors périmètre (volontairement)

Éditeur visuel de thèmes, IA, pixels marketing, app mobile native, analytics avancés, thèmes multiples — voir jalons M5+ de `architecture.md`.

## Prochaine étape

Validation de ce design system, puis `/replica-build` (M0 → M1: tranche verticale COD bout-en-bout).
