// lib/theme.ts — M5: thèmes no-code de la boutique.
// Le thème vit dans stores.settings.theme (JSON) ; la boutique publique injecte
// les variables CSS sur :root (src/app/shop/layout.tsx) — les tokens Tailwind
// (@theme inline) suivent automatiquement. 4 presets + couleurs personnalisables.

export type StoreTheme = {
  preset: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  radius: "sm" | "md" | "lg" | "pill";
  font: "sans" | "serif";
};

export const THEME_PRESETS: Record<string, Omit<StoreTheme, "preset">> = {
  terre: {
    bg: "#FBF7F1", surface: "#FFFFFF", text: "#221D16", muted: "#655B4C",
    accent: "#A83E14", accentHover: "#8F3410", accentSoft: "#F9E7DE",
    radius: "md", font: "sans",
  },
  nuit: {
    bg: "#14161B", surface: "#1D2027", text: "#F2EFE9", muted: "#A9A294",
    accent: "#E8734A", accentHover: "#F08A63", accentSoft: "#3A2A22",
    radius: "md", font: "sans",
  },
  pastel: {
    bg: "#F6F1FA", surface: "#FFFFFF", text: "#2E2440", muted: "#6F6390",
    accent: "#7C5CBF", accentHover: "#6A4CAB", accentSoft: "#EAE3F8",
    radius: "lg", font: "sans",
  },
  olive: {
    bg: "#F4F6EF", surface: "#FFFFFF", text: "#23281C", muted: "#5F6B52",
    accent: "#5C7A2E", accentHover: "#4C6626", accentSoft: "#E6EED6",
    radius: "pill", font: "serif",
  },
};

export const THEME_PRESET_NAMES: Record<string, { fr: string; ar: string }> = {
  terre: { fr: "Terre & Encre (défaut)", ar: "تراب وحبر (افتراضي)" },
  nuit: { fr: "Nuit", ar: "ليل" },
  pastel: { fr: "Pastel", ar: "باستيل" },
  olive: { fr: "Olive", ar: "زيتون" },
};

export const DEFAULT_THEME: StoreTheme = { preset: "terre", ...THEME_PRESETS.terre };

const HEX = /^#[0-9a-fA-F]{6}$/;
const RADIUS = { sm: "0.25rem", md: "0.5rem", lg: "0.9rem", pill: "9999px" } as const;
const FONT = {
  sans: "var(--font-sans)",
  serif: "Georgia, 'Times New Roman', serif",
} as const;

function cleanHex(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}

/** Fusion preset + overrides settings.theme (validation stricte, jamais d'injection CSS). */
export function resolveTheme(settings: unknown): StoreTheme {
  const s = (settings ?? {}) as Record<string, unknown>;
  const t = (s.theme ?? {}) as Record<string, unknown>;
  const presetName = typeof t.preset === "string" && THEME_PRESETS[t.preset] ? t.preset : "terre";
  const base = THEME_PRESETS[presetName];
  return {
    preset: presetName,
    bg: cleanHex(t.bg, base.bg),
    surface: cleanHex(t.surface, base.surface),
    text: cleanHex(t.text, base.text),
    muted: cleanHex(t.muted, base.muted),
    accent: cleanHex(t.accent, base.accent),
    accentHover: cleanHex(t.accentHover, base.accentHover),
    accentSoft: cleanHex(t.accentSoft, base.accentSoft),
    radius: (Object.keys(RADIUS) as (keyof typeof RADIUS)[]).includes(t.radius as never) ? (t.radius as StoreTheme["radius"]) : base.radius,
    font: t.font === "serif" ? "serif" : base.font,
  };
}

/** Variables CSS injectées sur :root côté storefront. */
export function themeToCssVars(theme: StoreTheme): string {
  const radius = RADIUS[theme.radius];
  const font = FONT[theme.font];
  return [
    `--bg: ${theme.bg};`,
    `--surface: ${theme.surface};`,
    `--surface-subtle: ${theme.surface};`,
    `--text: ${theme.text};`,
    `--text-muted: ${theme.muted};`,
    `--border: ${theme.muted}33;`,
    `--accent: ${theme.accent};`,
    `--accent-hover: ${theme.accentHover};`,
    `--accent-soft: ${theme.accentSoft};`,
    `--on-accent: #FFFFFF;`,
    `--radius-md: ${radius};`,
    `--font-sans: ${font};`,
  ].join("\n    ");
}

/** Commission plateforme (bps = points de base, 500 = 5 %) lue depuis settings. */
export function commissionBps(settings: unknown): number {
  const s = (settings ?? {}) as Record<string, unknown>;
  const bps = Number(s.commissionBps ?? 0);
  return Number.isFinite(bps) ? Math.min(10000, Math.max(0, Math.trunc(bps))) : 0;
}

/** Commission en millimes pour un montant donné. */
export function commissionFor(amountMinor: number, bps: number): number {
  return Math.floor((amountMinor * bps) / 10000);
}
