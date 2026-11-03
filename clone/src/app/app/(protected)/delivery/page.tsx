"use client";

import { useEffect, useState } from "react";
import { Button, Card, ErrorBox, Field, Input } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { GOVERNORATES, governorateLabel, DEFAULT_DELIVERY_FEE_MINOR } from "@/lib/governorates";
import { inputToMinor } from "@/lib/money";
import { formatMoney } from "@/lib/money";

export default function DeliveryPage() {
  const { t, locale } = useLocale();
  const [carriers, setCarriers] = useState<{ code: string; name: string }[]>([]);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/carriers").then((r) => r.json()).then((d) => setCarriers(d.carriers ?? []));
    fetch("/api/delivery-rates").then((r) => r.json()).then((d) => {
      const m: Record<string, string> = {};
      for (const r of d.rates ?? []) m[r.governorate] = r.feeMinor != null ? (r.feeMinor / 1000).toString() : (DEFAULT_DELIVERY_FEE_MINOR / 1000).toString();
      setFees(m);
    });
  }, []);

  async function save() {
    setError(""); setSaved(false); setLoading(true);
    const rates = GOVERNORATES.map((g) => ({ governorate: g.slug, feeMinor: inputToMinor(fees[g.slug] ?? "") ?? DEFAULT_DELIVERY_FEE_MINOR }));
    const res = await fetch("/api/delivery-rates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rates }),
    });
    setLoading(false);
    if (!res.ok) { setError(t("common.error")); return; }
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("delivery.title")}</h1>
      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t("delivery.carriers")}</p>
        <p className="text-xs text-text-muted">{t("delivery.carriersHint")}</p>
        <ul className="list-disc ps-5 text-sm">
          {carriers.map((c) => <li key={c.code}>{c.name}</li>)}
        </ul>
      </Card>
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{t("delivery.rates")}</p>
        {error && <ErrorBox message={error} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {GOVERNORATES.map((g) => (
            <Field key={g.slug} label={governorateLabel(g.slug, locale)}>
              <Input inputMode="decimal" dir="ltr" className="ltr-island" value={fees[g.slug] ?? ""} placeholder={formatMoney(DEFAULT_DELIVERY_FEE_MINOR, locale)}
                onChange={(e) => setFees({ ...fees, [g.slug]: e.target.value })} />
            </Field>
          ))}
        </div>
        <Button onClick={save} loading={loading} className="sm:w-auto">{t("delivery.save")}</Button>
        {saved && <p className="text-sm text-success">{t("delivery.saved")}</p>}
      </Card>
    </div>
  );
}
