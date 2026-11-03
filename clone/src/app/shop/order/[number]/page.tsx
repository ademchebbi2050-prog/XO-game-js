"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/components/store-provider";
import { useLocale } from "@/components/locale-provider";
import { Button, Card, EmptyState, ErrorBox, Field, Input, Price, StatusPill } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { normalizeTnPhone } from "@/lib/phone";

type TrackOrder = {
  number: string; status: string; trackingNumber: string | null; carrierName: string | null;
  governorate: string; totalMinor: number; deliveryFeeMinor: number; subtotalMinor: number;
  items: { nameSnapshot: string; priceMinor: number; qty: number }[];
  history: { status: string; note: string | null; createdAt: string }[];
};

export default function TrackPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const { slug } = useStore();
  const { t, locale } = useLocale();
  const search = useSearchParams();
  const [phone, setPhone] = useState(search.get("phone") ?? "");
  const [order, setOrder] = useState<TrackOrder | null>(null);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function lookup(p: string) {
    setError(""); setSearched(true);
    const pn = normalizeTnPhone(p);
    if (!pn) { setError(t("common.invalidPhone")); return; }
    const r = await fetch(`/api/public/orders/${number}?phone=${encodeURIComponent(pn)}&slug=${slug}`);
    const d = await r.json();
    if (!r.ok) { setError(t("track.notFound")); setOrder(null); }
    else setOrder(d.order);
  }

  useEffect(() => {
    if (search.get("phone")) lookup(search.get("phone") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number]);

  if (!searched || (!order && !error)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">{t("track.title")}</h1>
        <Card className="flex flex-col gap-3">
          <p className="ltr-island font-mono text-sm font-bold">{number}</p>
          <Field label={t("track.phone")} error={error || undefined}>
            <Input inputMode="tel" dir="ltr" className="ltr-island" placeholder="98 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Button onClick={() => lookup(phone)}>{t("track.submit")}</Button>
        </Card>
      </div>
    );
  }

  if (!order) return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("track.title")}</h1>
      <ErrorBox message={error || t("track.notFound")} />
      <Link href="/shop"><Button variant="secondary">{t("confirm.back")}</Button></Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("track.title")}</h1>
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="ltr-island font-mono text-sm font-bold">{order.number}</p>
          <StatusPill status={order.status as never} label={t(`orders.status.${order.status}` as never) as string} />
        </div>
        {order.trackingNumber && <p className="text-sm">📦 {t("orders.detail.tracking")}: <span className="ltr-island font-mono text-xs">{order.trackingNumber}</span>{order.carrierName ? ` (${order.carrierName})` : ""}</p>}
        {order.items.map((it, i) => (
          <div key={i} className="flex justify-between text-sm"><span>{it.nameSnapshot} <span className="ltr-island text-text-muted">×{it.qty}</span></span><Price minor={it.priceMinor * it.qty} /></div>
        ))}
        <hr className="border-border" />
        <div className="flex justify-between text-sm"><span className="text-text-muted">{t("checkout.deliveryFee")}</span><Price minor={order.deliveryFeeMinor} /></div>
        <div className="flex justify-between font-extrabold"><span>{t("orders.detail.total")}</span><Price minor={order.totalMinor} /></div>
      </Card>
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{t("track.history")}</p>
        <ol className="relative flex flex-col gap-3 border-s-2 border-border ps-4">
          {order.history.map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -start-[23px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-accent" aria-hidden />
              <p className="text-sm font-semibold"><StatusPill status={h.status as never} label={t(`orders.status.${h.status}` as never) as string} /></p>
              {h.note && <p className="text-xs text-text-muted">{h.note}</p>}
              <p className="text-xs text-text-muted">{formatDate(h.createdAt, locale)}</p>
            </li>
          ))}
        </ol>
      </Card>
      <Link href="/shop"><Button variant="secondary">{t("confirm.back")}</Button></Link>
    </div>
  );
}
