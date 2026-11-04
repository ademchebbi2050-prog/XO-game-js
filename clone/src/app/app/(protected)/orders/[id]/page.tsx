"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle, ChevronLeft, Truck } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Button, Card, StatusPill, Price, PhoneLink, Skeleton, ErrorBox, Select, Field, Input } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { telHref, whatsappHref } from "@/lib/phone";
import { governorateLabel } from "@/lib/governorates";
import type { OrderStatus, CallOutcome } from "@/generated/prisma/client";

type OrderDetail = {
  id: string; number: string; status: OrderStatus; customerName: string; customerPhone: string;
  governorate: string; address: string; subtotalMinor: number; deliveryFeeMinor: number; discountMinor: number;
  totalMinor: number; trackingNumber: string | null; paymentStatus: string; createdAt: string;
  items: { nameSnapshot: string; priceMinor: number; qty: number }[];
  statusHistory: { status: OrderStatus; note: string | null; createdAt: string }[];
  callAttempts: { outcome: CallOutcome; note: string | null; at: string }[];
  carrier: { name: string } | null;
};

const NEXT_ACTIONS: { to: OrderStatus; key: string }[] = [
  { to: "to_confirm", key: "orders.detail.markToConfirm" },
  { to: "confirmed", key: "orders.detail.markConfirmed" },
  { to: "shipped", key: "orders.detail.markShipped" },
  { to: "delivered", key: "orders.detail.markDelivered" },
  { to: "returned", key: "orders.detail.markReturned" },
  { to: "cancelled", key: "orders.detail.markCancelled" },
];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useLocale();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [storeSlug, setStoreSlug] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [carriers, setCarriers] = useState<{ id: string; name: string }[]>([]);
  const [carrierId, setCarrierId] = useState("");

  async function load() {
    const r = await fetch(`/api/orders/${id}`);
    const d = await r.json();
    if (r.ok) { setOrder(d.order); setStoreSlug(d.storeSlug ?? ""); } else setErr(t("common.error"));
  }
  useEffect(() => {
    load();
    fetch("/api/carriers").then((r) => r.json()).then((d) => setCarriers(d.carriers ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function changeStatus(to: OrderStatus) {
    setBusy(true);
    const r = await fetch(`/api/orders/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to, note }),
    });
    setBusy(false);
    if (r.ok) { setNote(""); await load(); }
    else setErr(t("orders.detail.invalidTransition"));
  }

  async function logCall(outcome: CallOutcome) {
    setBusy(true);
    await fetch(`/api/orders/${id}/calls`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    setBusy(false);
    await load();
  }

  async function ship() {
    if (!carrierId) return;
    setBusy(true);
    await fetch(`/api/orders/${id}/ship`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrierId }),
    });
    setBusy(false);
    await load();
  }

  if (err && !order) return <ErrorBox message={err} />;
  if (!order) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/app/orders" aria-label={t("common.back")} className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-subtle">
          <ChevronLeft className="h-5 w-5 flip-rtl" />
        </Link>
        <h1 className="text-xl font-bold">
          <span className="ltr-island font-mono text-base text-text-muted">{order.number}</span>
        </h1>
        <span className="ms-auto"><StatusPill status={order.status} label={t(`orders.status.${order.status}` as never) as string} /></span>
      </div>

      {err && <ErrorBox message={err} />}

      {/* Actions contact */}
      <Card className="flex flex-wrap gap-2">
        <a href={telHref(order.customerPhone)} onClick={() => logCall("answered")}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-surface-subtle sm:flex-none">
          <Phone className="h-4 w-4" /> {t("orders.detail.call")}
        </a>
        <a href={whatsappHref(order.customerPhone)} target="_blank" rel="noopener" onClick={() => logCall("whatsapp")}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-surface-subtle sm:flex-none">
          <MessageCircle className="h-4 w-4" /> {t("orders.detail.whatsapp")}
        </a>
        <button onClick={() => logCall("no_answer")} disabled={busy}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-warning-soft px-4 text-sm font-semibold text-warning sm:flex-none disabled:opacity-50">
          {t("orders.status.unreachable")}
        </button>
      </Card>

      {/* Infos client */}
      <Card className="flex flex-col gap-1 text-sm">
        <p><span className="font-semibold">{t("orders.detail.customer")}:</span> {order.customerName}</p>
        <p><span className="font-semibold">{t("orders.detail.phone")}:</span> <PhoneLink phone={order.customerPhone} /></p>
        <p><span className="font-semibold">{t("orders.detail.governorate")}:</span> {governorateLabel(order.governorate, locale)}</p>
        <p><span className="font-semibold">{t("orders.detail.address")}:</span> {order.address}</p>
        <p><span className="font-semibold">{t("orders.detail.payment")}:</span> <span className="ltr-island">{order.paymentStatus}</span></p>
        {order.trackingNumber && (
          <p><span className="font-semibold">{t("orders.detail.tracking")}:</span> <span className="ltr-island font-mono text-xs">{order.trackingNumber}</span> {order.carrier?.name ? `(${order.carrier.name})` : ""}</p>
        )}
      </Card>

      {/* Articles + totaux */}
      <Card className="flex flex-col gap-2 text-sm">
        <p className="font-semibold">{t("orders.detail.items")}</p>
        {order.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className="truncate">{it.nameSnapshot} <span className="ltr-island text-text-muted">×{it.qty}</span></span>
            <Price minor={it.priceMinor * it.qty} />
          </div>
        ))}
        <hr className="border-border" />
        <div className="flex justify-between"><span className="text-text-muted">{t("orders.detail.subtotal")}</span><Price minor={order.subtotalMinor} /></div>
        <div className="flex justify-between"><span className="text-text-muted">{t("orders.detail.deliveryFee")}</span><Price minor={order.deliveryFeeMinor} /></div>
        <div className="flex justify-between text-base font-bold"><span>{t("orders.detail.total")}</span><Price minor={order.totalMinor} /></div>
      </Card>

      {/* Expédition */}
      {order.status === "confirmed" && (
        <Card className="flex flex-col gap-2">
          <Field label={t("delivery.ship")}>
            <div className="flex gap-2">
              <Select value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
                <option value="">—</option>
                {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Button onClick={ship} disabled={!carrierId || busy}><Truck className="h-4 w-4" />{t("orders.detail.markShipped")}</Button>
            </div>
          </Field>
        </Card>
      )}

      {/* Transitions de statut */}
      <Card className="flex flex-col gap-2">
        <Field label={t("orders.detail.note")}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {NEXT_ACTIONS.filter((a) => a.to !== "shipped" || order.status === "confirmed").map((a) => (
            <Button key={a.to} variant={a.to === "cancelled" ? "danger" : a.to === "delivered" ? "primary" : "secondary"}
              disabled={busy} onClick={() => changeStatus(a.to)}>
              {t(a.key as never)}
            </Button>
          ))}
        </div>
      </Card>

      {/* Timeline */}
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{t("orders.detail.history")}</p>
        <ol className="relative flex flex-col gap-3 border-s-2 border-border ps-4">
          {[...order.statusHistory].reverse().map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -start-[23px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-accent" aria-hidden />
              <p className="text-sm font-semibold"><StatusPill status={h.status} label={t(`orders.status.${h.status}` as never) as string} /></p>
              {h.note && <p className="text-xs text-text-muted">{h.note}</p>}
              <p className="text-xs text-text-muted">{formatDate(h.createdAt, locale)}</p>
            </li>
          ))}
          {[...order.callAttempts].reverse().map((c, i) => (
            <li key={`c${i}`} className="relative">
              <span className="absolute -start-[23px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-warning" aria-hidden />
              <p className="text-sm text-text-muted">📞 {t(`orders.status.${c.outcome}` as never) as string}{c.note ? ` — ${c.note}` : ""}</p>
              <p className="text-xs text-text-muted">{formatDate(c.at, locale)}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
