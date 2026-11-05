"use client";

// M5 — Notifications push (simulées en local, VAPID/Web Push en prod).
// "Activer" enregistre un abonnement sim://device/<uuid> ; chaque changement de
// statut de commande écrit une ligne dans l'outbox ci-dessous (push_events).
import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Button, Card, EmptyState } from "@/components/ui";

type Sub = { id: string; endpoint: string; createdAt: string };
type Ev = { id: string; title: string; body: string; url: string | null; status: string; createdAt: string; sentAt: string | null };

export default function NotificationsPage() {
  const { t, locale } = useLocale();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const s = await fetch("/api/push/subscribe").then((r) => r.json()).catch(() => ({}));
    setSubs(s.subscriptions ?? []);
    const e = await fetch("/api/push/events?limit=50").then((r) => r.json()).catch(() => ({}));
    setEvents(e.events ?? []);
  }
  useEffect(() => { load(); }, []);

  async function enable() {
    setMsg("");
    let endpoint = localStorage.getItem("push:endpoint");
    if (!endpoint) {
      endpoint = `sim://device/${crypto.randomUUID()}`;
      localStorage.setItem("push:endpoint", endpoint);
    }
    const r = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, keys: { p256dh: "sim", auth: "sim" } }),
    });
    if (r.ok) { setMsg(t("push.enabled")); await load(); }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("push.title")}</h1>
      <Card className="flex max-w-xl flex-col gap-3">
        <p className="text-sm font-semibold">{t("push.subscriptions")}</p>
        <p className="text-xs text-text-muted">{t("push.hint")}</p>
        <div>
          <Button variant="secondary" className="sm:w-auto" onClick={enable}>
            <BellRing className="h-4 w-4" /> {subs.length ? t("push.reenable") : t("push.enable")}
          </Button>
          {msg && <span className="ms-2 text-xs font-semibold text-success">{msg}</span>}
        </div>
        <ul className="flex flex-col gap-1">
          {subs.map((s) => (
            <li key={s.id} className="ltr-island rounded-md bg-surface-subtle px-3 py-2 font-mono text-xs">{s.endpoint}</li>
          ))}
        </ul>
      </Card>
      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t("push.outbox")}</p>
        {events.length === 0 ? (
          <EmptyState title={t("push.empty")} hint={t("push.hint")} action={<Bell className="h-6 w-6 text-text-muted" />} />
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold">{e.title} — <span className="text-text-muted">{e.body}</span></p>
                <p className="mt-1 text-xs text-text-muted ltr-island">
                  {new Date(e.createdAt).toLocaleString(locale === "ar" ? "ar-TN" : "fr-TN")} · {e.status}
                  {e.url && <> · <a href={e.url} className="text-accent hover:underline ltr-island">{e.url}</a></>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
