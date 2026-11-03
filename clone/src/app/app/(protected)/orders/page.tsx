"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { EmptyState, Skeleton, StatusPill, Price, PhoneLink, Button } from "@/components/ui";
import { formatDate } from "@/lib/format";

type OrderRow = { id: string; number: string; customerName: string; customerPhone: string; totalMinor: number; status: string; createdAt: string; _count: { callAttempts: number } };
const STATUSES = ["new", "to_confirm", "unreachable", "confirmed", "shipped", "delivered", "returned", "cancelled"] as const;

export default function OrdersPage() {
  const { t, locale } = useLocale();
  const [data, setData] = useState<{ orders: OrderRow[]; total: number } | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const h = setTimeout(() => {
      const p = new URLSearchParams({ limit: "30" });
      if (status) p.set("status", status);
      if (q) p.set("q", q);
      fetch(`/api/orders?${p}`)
        .then((r) => r.json())
        .then((d) => setData({ orders: d.orders ?? [], total: d.total ?? 0 }));
    }, 250);
    return () => clearTimeout(h);
  }, [status, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{t("orders.title")}</h1>
        <Link href="/app/orders/new"><Button><Plus className="h-4 w-4" />{t("orders.newOrder")}</Button></Link>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("orders.searchPlaceholder")}
            className="h-11 w-full rounded-md border border-border-input bg-surface ps-9 pe-3 text-base" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="h-11 rounded-md border border-border-input bg-surface px-3 text-sm">
          <option value="">{t("orders.allStatuses")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`orders.status.${s}` as never)}</option>)}
        </select>
      </div>

      {!data && <Skeleton className="h-40" />}
      {data && data.orders.length === 0 && <EmptyState title={t("orders.emptyTitle")} hint={t("orders.emptyHint")} />}
      <div className="flex flex-col gap-2">
        {data?.orders.map((o) => (
          <Link key={o.id} href={`/app/orders/${o.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-card hover:bg-surface-subtle">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                <span className="ltr-island font-mono text-xs text-text-muted">{o.number}</span> · {o.customerName}
              </p>
              <p className="text-xs text-text-muted"><PhoneLink phone={o.customerPhone} /> · {formatDate(o.createdAt, locale)}</p>
            </div>
            <Price minor={o.totalMinor} className="hidden text-sm font-bold sm:inline" />
            <StatusPill status={o.status as never} label={t(`orders.status.${o.status}` as never) as string} />
            <ChevronRight className="h-5 w-5 text-text-muted flip-rtl" />
          </Link>
        ))}
      </div>
    </div>
  );
}
