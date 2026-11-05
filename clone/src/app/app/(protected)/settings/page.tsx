"use client";

import { useEffect, useState } from "react";
import { Button, Card, ErrorBox, Field, Input } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { normalizeTnPhone } from "@/lib/phone";
import { THEME_PRESETS, THEME_PRESET_NAMES, resolveTheme, type StoreTheme } from "@/lib/theme"; // M5

type Store = { id: string; name: string; slug: string; status: string; settings?: Record<string, unknown> }; // M5: settings
type Blocked = { phone: string; reason: string | null };

export default function SettingsPage() {
  const { t } = useLocale();
  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  // M5: thème no-code + commission
  const [theme, setTheme] = useState<StoreTheme & { _custom?: boolean }>(resolveTheme({}));
  const [commissionBps, setCommissionBps] = useState("0");
  const [saved, setSaved] = useState("");
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").replace(/^app\./, "");

  async function load() {
    const s = await fetch("/api/stores").then((r) => r.json());
    const cookie = document.cookie.match(/store_id=([^;]+)/);
    const active = (cookie && s.stores?.find((x: Store) => x.id === decodeURIComponent(cookie[1]))) || s.stores?.[0];
    if (active) {
      setStore(active);
      setName(active.name);
      setTheme(resolveTheme(active.settings ?? {})); // M5
      setCommissionBps(String((active.settings as Record<string, unknown> | undefined)?.commissionBps ?? 0)); // M5
    }
    const b = await fetch("/api/blocked-phones").then((r) => r.json());
    setBlocked(b.blocked ?? []);
  }
  useEffect(() => { load(); }, []);

  async function saveStore() {
    if (!store) return;
    await fetch(`/api/stores/${store.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  // M5: enregistre le thème + la commission dans stores.settings (merge serveur)
  async function saveAppearance() {
    if (!store) return;
    setSaved("");
    const r = await fetch(`/api/stores/${store.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { theme: (({ _custom, ...clean }) => clean)(theme as StoreTheme & { _custom?: boolean }), commissionBps: Math.max(0, Math.min(10000, Math.trunc(Number(commissionBps) || 0))) } }),
    });
    if (r.ok) { setSaved(t("settings.saved")); await load(); }
  }

  async function block() {
    setError("");
    const p = normalizeTnPhone(phone);
    if (!p) { setError(t("common.invalidPhone")); return; }
    const r = await fetch("/api/blocked-phones", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: p }),
    });
    if (r.ok) { setPhone(""); await load(); }
  }

  async function unblock(p: string) {
    await fetch(`/api/blocked-phones?phone=${encodeURIComponent(p)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("settings.title")}</h1>
      {store && (
        <Card className="flex max-w-xl flex-col gap-3">
          <p className="text-sm font-semibold">{t("settings.store")}</p>
          <Field label={t("settings.storeName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveStore} />
          </Field>
          <p className="text-sm"><span className="font-semibold">{t("settings.storeUrl")}:</span>{" "}
            <a href={`http://${store.slug}.${rootDomain}`} target="_blank" rel="noopener" className="ltr-island font-mono text-xs text-accent hover:underline">
              {store.slug}.{rootDomain}
            </a>
          </p>
          <p className="text-sm"><span className="font-semibold">{t("settings.status")}:</span> {t(store.status === "published" ? "settings.published" : "settings.draft")}</p>
          <Button variant="secondary" className="sm:w-auto" onClick={async () => {
            await fetch(`/api/stores/${store.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: store.status === "published" ? "draft" : "published" }) });
            await load();
          }}>
            {store.status === "published" ? t("settings.draft") : t("settings.published")}
          </Button>
        </Card>
      )}
      {/* M5: thème no-code */}
      {store && (
        <Card className="flex max-w-xl flex-col gap-3">
          <p className="text-sm font-semibold">{t("settings.theme")}</p>
          <p className="text-xs text-text-muted">{t("settings.themeHint")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("settings.theme")}>
            {Object.entries(THEME_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                role="radio"
                aria-checked={theme.preset === key && !theme._custom}
                onClick={() => setTheme({ ...resolveTheme({ theme: { preset: key } }), preset: key, _custom: false })}
                className={`flex flex-col items-center gap-1 rounded-md border p-2 ${theme.preset === key ? "border-accent bg-accent-soft" : "border-border-input bg-surface"}`}
              >
                <span className="flex gap-0.5">
                  {[preset.bg, preset.surface, preset.accent, preset.text].map((c) => (
                    <span key={c} className="h-4 w-4 rounded-sm border border-black/10" style={{ backgroundColor: c }} />
                  ))}
                </span>
                <span className="text-xs font-semibold">{THEME_PRESET_NAMES[key][useLocale().locale as "fr" | "ar"] ?? key}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("settings.colorAccent")}>
              <input type="color" value={theme.accent} onChange={(e) => setTheme({ ...theme, accent: e.target.value, accentHover: e.target.value, _custom: true } as StoreTheme)} className="h-10 w-full rounded-md border border-border-input bg-surface" />
            </Field>
            <Field label={t("settings.colorBg")}>
              <input type="color" value={theme.bg} onChange={(e) => setTheme({ ...theme, bg: e.target.value, _custom: true } as StoreTheme)} className="h-10 w-full rounded-md border border-border-input bg-surface" />
            </Field>
            <Field label={t("settings.colorText")}>
              <input type="color" value={theme.text} onChange={(e) => setTheme({ ...theme, text: e.target.value, _custom: true } as StoreTheme)} className="h-10 w-full rounded-md border border-border-input bg-surface" />
            </Field>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border p-2" style={{ backgroundColor: theme.bg, color: theme.text }}>
            <span className="rounded-md px-3 py-1 text-xs font-bold" style={{ backgroundColor: theme.accent, color: "#fff" }}>{t("settings.preview")}</span>
            <span className="text-xs" style={{ color: theme.muted }}>{t("settings.previewText")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Field label={t("settings.commissionBps")} className="flex-1">
              <Input inputMode="numeric" dir="ltr" className="ltr-island" value={commissionBps} onChange={(e) => setCommissionBps(e.target.value.replace(/[^0-9]/g, ""))} />
            </Field>
            <span className="mt-6 text-xs text-text-muted">{t("settings.commissionHint")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="sm:w-auto" onClick={saveAppearance}>{t("settings.saveAppearance")}</Button>
            {saved && <span className="text-xs font-semibold text-success">{saved}</span>}
          </div>
        </Card>
      )}
      <Card className="flex max-w-xl flex-col gap-3">
        <p className="text-sm font-semibold">{t("settings.blockedPhones")}</p>
        <p className="text-xs text-text-muted">{t("settings.blockedHint")}</p>
        {error && <ErrorBox message={error} />}
        <div className="flex gap-2">
          <Input inputMode="tel" dir="ltr" className="ltr-island flex-1" placeholder="+216 98 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button variant="danger" onClick={block} className="sm:w-auto">{t("settings.block")}</Button>
        </div>
        <ul className="flex flex-col gap-1">
          {blocked.map((b) => (
            <li key={b.phone} className="flex items-center justify-between rounded-md bg-surface-subtle px-3 py-2 text-sm">
              <span className="ltr-island font-mono text-xs">{b.phone}</span>
              <button onClick={() => unblock(b.phone)} className="text-xs font-semibold text-accent hover:underline">{t("settings.unblock")}</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
