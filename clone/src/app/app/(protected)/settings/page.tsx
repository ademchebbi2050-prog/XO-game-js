"use client";

import { useEffect, useState } from "react";
import { Button, Card, ErrorBox, Field, Input } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { normalizeTnPhone } from "@/lib/phone";

type Store = { id: string; name: string; slug: string; status: string };
type Blocked = { phone: string; reason: string | null };

export default function SettingsPage() {
  const { t } = useLocale();
  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").replace(/^app\./, "");

  async function load() {
    const s = await fetch("/api/stores").then((r) => r.json());
    const cookie = document.cookie.match(/store_id=([^;]+)/);
    const active = (cookie && s.stores?.find((x: Store) => x.id === decodeURIComponent(cookie[1]))) || s.stores?.[0];
    if (active) { setStore(active); setName(active.name); }
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
