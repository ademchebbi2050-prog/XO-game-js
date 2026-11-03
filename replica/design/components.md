# Spécifications des composants — clone COD (design system "Terre & Encre")

Format: variantes / tailles / états / tokens / a11y / écrans (S-IDs de `replica/recon.md`).
Règles globales: cibles tactiles ≥ 44px, focus visible (ring 2px `accent` + offset 2px),
états disabled/loading/empty toujours prévus, **aucun `left/right` en dur** (utilitaires
logiques `ms-/me-/ps-/pe-/start-/end-`), icônes directionnelles avec `.flip-rtl`,
`.ltr-island` sur téléphones/n° de commande/tracking. Police: `font-sans` (fr) / `font-arabic` (ar).

---

## Button
- variants: `primary` (bg-accent, text-on-accent), `secondary` (bg-surface, border, text), `ghost` (transparent, text-accent), `danger` (bg-danger, text-white)
- tailles: sm 36px, md 44px (défaut, tactile), lg 48px; pleine largeur sur mobile (`w-full sm:w-auto`)
- états: default, hover (`bg-accent-hover` pour primary), active (scale .98), focus-visible (ring), disabled (opacité 50%, curseur interdit), loading (spinner + label conservé pour lecteurs d'écran, `aria-busy`)
- tokens: radius-md, font sm/600, padding `px-4 py-2` (md), transition duration-base ease-brand
- a11y: vrai `<button>`; type explicite; loading annonce via `aria-live="polite"`
- used on: S01, S02, S03, S06, S08, S23

## IconButton
- variantes: ghost, surface; taille 44px; icône Lucide 20px
- états: idem Button; `aria-label` obligatoire (ex. "Appeler le client")
- used on: S07, S08, TopBar

## Field (enveloppe label + hint + erreur)
- structure: `<label>` + contrôle + hint (`text-xs text-muted`) + erreur (`text-xs text-danger`, `role="alert"`, `aria-describedby`)
- états: default, focus-within (bordure accent), error (bordure danger + message), disabled
- tokens: space-2 entre label et champ, space-1 pour hint/erreur
- used on: S01, S02, S06, S08, S15, S23

## Input / Textarea / Select
- commun: bg-surface, border `border-input`, radius-md, h-44px (md), font base, `px-3`
- états: default, hover (border text-muted), focus (border-accent + ring 2px accent), error (border-danger), disabled (bg-surface-subtle), placeholder `text-muted`
- Select: chevron Lucide `.flip-rtl`, menu déroulant en popover (ancré, jamais de positionnement left/right en dur)
- a11y: label associé, `aria-invalid`, erreur liée par `aria-describedby`
- used on: S01, S02, S06, S08, S15, S23

## PhoneInput (+216)
- prefix fixe `+216` en `.ltr-island`, masque 8 chiffres, validation `^\+216\d{8}$`
- erreur dédiée: "Numéro invalide (8 chiffres après +216)"
- used on: S02, S08, S23

## Toggle / Checkbox
- Toggle: 44x24px, knob, `role="switch"`, `aria-checked`; on = bg-accent
- Checkbox: 20px, radius-sm, check Lucide
- used on: S15

## StatusPill (statut de commande)
- variantes = statuts: new, to_confirm, unreachable, confirmed, shipped, delivered, returned, cancelled
- style: fond `status-X-soft`, texte `status-X`, radius-pill, font xs/600, point 6px de la même couleur
- ex. classe: `bg-status-to-confirm-soft text-status-to-confirm`
- contraste: vérifié AA pour les 8 paires (voir contrast-report.txt)
- used on: S04, S07, S08, S24

## Badge / Chip (générique: stock faible, repeat buyer...)
- variantes: neutral (surface-subtle/text), success, warning, danger, accent
- tailles: sm (h 20px, xs/500), md (h 24px, sm/500)
- used on: S05, S06, S07, S08

## Card
- bg-surface, border, radius-lg, shadow-card, padding p-4 (mobile) / p-6 (lg)
- variante `flat` (sans ombre, fond surface-subtle)
- used on: S04, S05, S06, S07, S08, S19–S24

## KPIStat (dashboard)
- label (sm, text-muted), valeur (xl/700, `.ltr-island` pour montants/numéros), delta (xs, success/danger + icône `.flip-rtl` TrendingUp/Down)
- grille: 2 colonnes mobile, 4 colonnes ≥ md
- used on: S04

## Chart (SVG maison, zéro lib)
- barres (CA par jour) + ligne (commandes); axes en text-muted xs; tooltips natifs `title`
- couleurs: accent (barres), status-shipped (ligne); fond transparent
- accessible: `role="img"` + `aria-label` résumé + table de données masquée visuellement (sr-only)
- used on: S04

## OrderCard ↔ DataTable (liste commandes, mobile-first)
- **mobile (< lg)**: liste de cartes — n° commande (mono, ltr-island), client + téléphone (ltr-island), StatusPill, total, chevron `.flip-rtl`; tap → drawer (S08)
- **≥ lg**: DataTable — colonnes triables (n°, date, client, total, statut), recherche + filtres statut en haut, lignes cliquables
- états: loading (skeleton), empty (EmptyState), erreur (retry)
- used on: S07

## Timeline (historique statuts + appels, S08/S24)
- verticale, points colorés par statut, ligne de liaison `border-s` (logique: bord start)
- entrée: heure (text-muted xs), statut (StatusPill), note, auteur; appels = icône Phone/WhatsApp
- used on: S08, S24

## ActionBar commande (S08, mobile-first)
- boutons d'action selon statut: **Appeler** (`tel:+216...`, icône Phone), **WhatsApp** (`https://wa.me/216...`, icône MessageCircle), boutons de statut (Confirmer, Expédier, Livrée, Retour, Annuler) en bottom sheet sur mobile, inline ≥ lg
- chaque appel logué via POST /api/orders/[id]/calls
- used on: S08

## BottomNav (dashboard mobile) / Sidebar (≥ lg)
- onglets: Accueil, Commandes (badge nb nouvelles), Produits, Livraison, Réglages — icônes Lucide + label xs; actif = text-accent + indicateur haut (border-t-2 accent, logique)
- sidebar ≥ lg: largeur `--sidebar-w` 240px, logo wordmark, nav verticale, store switcher en haut
- used on: all dashboard

## TopBar
- h `--header-h` 56px, bg-surface, border-b; store switcher (mobile), recherche (S07), bell (badge), avatar
- used on: dashboard

## SearchBar
- input avec icône Search (start), clear button; debounce 300ms
- used on: S05, S07

## Modal / Dialog et Drawer
- Modal: centré, overlay rgba(34,29,22,.4), radius-lg, shadow-pop, focus trap, `Esc` ferme, retour du focus
- Drawer: bottom sheet mobile (h max 85dvh, radius-t-lg), côté (end) ≥ lg; drag handle
- used on: S06, S08 (confirmations), S15

## Toast
- bas-centre mobile, bas-end ≥ lg; variantes success/danger/info; auto-dismiss 4s, `role="status"`/`role="alert"`
- used on: all

## EmptyState
- icône Lucide neutre, titre lg/600, texte sm text-muted, CTA primary
- copies rédigées à neuf (jamais celles de l'original)
- used on: S04, S05, S07, S19, S20

## Skeleton
- blocs bg-surface-subtle, radius-md, animation pulse (respect `prefers-reduced-motion`)
- used on: S04, S05, S07, S19–S22

## ProductCard (boutique publique)
- image (ratio 4/3, webp, lazy), nom (sm/600), prix (base/700, `.ltr-island`), badge rupture (danger-soft)
- grille 2 colonnes mobile, 3 ≥ sm, 4 ≥ lg; tap → S21
- used on: S19, S20

## CartLine + Récap (S22/S23)
- CartLine: image 64px, nom, prix unitaire, stepper quantité (− qty +, cibles 44px), supprimer (icône)
- Récap: sous-total, livraison, total (xl/700); CTA sticky bottom mobile ("Commander — 79,000 TND")
- used on: S22, S23

## CheckoutForm (S23 — très court)
- champs: téléphone (+216), nom, gouvernorat (Select 24), adresse, mode de livraison (radio cards avec prix), paiement COD (radio fixe, icône Truck), note facultative
- ordre mobile: téléphone → nom → gouvernorat → adresse → livraison → récap sticky → CTA
- erreurs inline par champ; double-submit bloqué (loading sur CTA + idempotency-key)
- used on: S23

## ImageUploader (S06)
- zone drop + bouton, aperçu grille (max 8), suppression par image; limites 5 Mo, jpeg/png/webp/avif (voir architecture §6)
- used on: S06

## Avatar + StoreSwitcher
- avatar: initiales sur fond accent-soft/text-accent, 32/40px
- switcher: liste des boutiques du user (multi-boutique), lien vers `<slug>.<domaine>`
- used on: TopBar, S15

## Pagination
- Précédent/Suivant (icônes `.flip-rtl`) + "page x / y"; 20 lignes/page
- used on: S05, S07 (≥ lg)

## Lien externe d'action (Appeler / WhatsApp / Voir boutique)
- `<a href="tel:+216...">` / `<a href="https://wa.me/216..." target="_blank" rel="noopener">`; style bouton secondaire avec icône; numéro affiché `.ltr-island`
- used on: S08, S24, S15
