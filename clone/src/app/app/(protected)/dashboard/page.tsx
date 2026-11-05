"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { Card, EmptyState, Skeleton, StatusPill, Price, PhoneLink } from "@/components/ui";
import { formatPercent } from "@/lib/format";

type Stats = {
  stats: { ordersTotal: number; confirmationRate: number; deliveryRate: number; revenueMinor: number; commissionBps?: number; commissionMinor?: number; netMinor?: number }; // M5
  series: { date: string; revenue: number; orders: number }[];
  recent: { id: string; number: string; customerName: string; customerPhone: string; totalMinor: number; status: string; createdAt: string }[];
};

export default function DashboardPage() {
  const { t, locale } = useLocale();
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState("all");

  useEffect(() => {
    setData(null);
    fetch(`/api/dashboard/stats?range=${range}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(t("common.error")) : setData(d)))
      .catch(() => setErr(t("common.error")));
  }, [range, t]);

  const maxRev = data ? Math.max(1, ...data.series.map((s) => s.revenue)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("dashboard.title")}</h1>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="h-9 rounded-md border border-border-input bg-surface px-2 text-sm"
          aria-label={t("dashboard.rangeAll")}
        >
          <option value="7d">{t("dashboard.range7d")}</option>
          <option value="30d">{t("dashboard.range30d")}</option>
          <option value="all">{t("dashboard.rangeAll")}</option>
        </select>
      </div>

      {!data && !err && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <p className="text-xs font-medium text-text-muted">{t("dashboard.ordersTotal")}</p>
              <p className="mt-1 text-2xl font-extrabold ltr-island">{data.stats.ordersTotal}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-text-muted">{t("dashboard.confirmationRate")}</p>
              <p className="mt-1 text-2xl font-extrabold ltr-island">{formatPercent(Math.round(data.stats.confirmationRate * 100), 100, locale)}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-text-muted">{t("dashboard.deliveryRate")}</p>
              <p className="mt-1 text-2xl font-extrabold ltr-island">{formatPercent(Math.round(data.stats.deliveryRate * 100), 100, locale)}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-text-muted">{t("dashboard.revenue")}</p>
              <p className="mt-1 text-2xl font-extrabold"><Price minor={data.stats.revenueMinor} /></p>
            </Card>
          </div>
          {/* M5: commission plateforme + net */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <p className="text-xs font-medium text-text-muted">{t("dashboard.commission")} ({data.stats.commissionBps ?? 0} bps)</p>
              <p className="mt-1 text-xl font-extrabold text-warning"><Price minor={data.stats.commissionMinor ?? 0} /></p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-text-muted">{t("dashboard.net")}</p>
              <p className="mt-1 text-xl font-extrabold text-success"><Price minor={data.stats.netMinor ?? 0} /></p>
            </Card>
          </div>

          {/* mini graphique CA (barres SVG maison) */}
          <Card>
            <div className="flex h-28 items-end gap-1" role="img" aria-label={t("dashboard.revenue")}>
              {data.series.map((s) => (
                <div key={s.date} className="flex-1 rounded-t-sm bg-accent/70" style={{ height: `${(s.revenue / maxRev) * 100}%`, minHeight: s.revenue > 0 ? 4 : 1 }} title={`${s.date}: ${s.revenue}`} />
              ))}
            </div>
          </Card>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("dashboard.recentOrders")}</h2>
              <Link href="/app/orders" className="text-sm font-semibold text-accent hover:underline">{t("orders.title")}</Link>
            </div>
            {data.recent.length === 0 ? (
              <EmptyState title={t("dashboard.emptyTitle")} hint={t("dashboard.emptyHint")} />
            ) : (
              <div className="flex flex-col gap-2">
                {data.recent.map((o) => (
                  <Link key={o.id} href={`/app/orders/${o.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-card hover:bg-surface-subtle">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        <span className="ltr-island font-mono text-xs text-text-muted">{o.number}</span> · {o.customerName}
                      </p>
                      <p className="text-xs text-text-muted"><PhoneLink phone={o.customerPhone} /></p>
                    </div>
                    <Price minor={o.totalMinor} className="text-sm font-bold" />
                    <StatusPill status={o.status as never} label={t(`orders.status.${o.status}` as never) as string} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
