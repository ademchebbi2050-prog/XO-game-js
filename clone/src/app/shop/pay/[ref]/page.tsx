"use client";

// M5 — hosted-checkout du PSP SIMULÉ (SimPSP). En prod, le client serait redirigé
// vers la vraie page de la banque/PSP; ici, cette page joue le rôle du PSP:
// elle affiche le montant et propose "Payer" (succès) ou "Refuser" (échec).
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, XCircle } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Button, Card, Price, Skeleton } from "@/components/ui";

type PspView = {
  pspRef: string;
  amountMinor: number;
  currency: string;
  status: string;
  authCode: string | null;
  order: { id: string; number: string } | null;
  storeName: string | null;
};

export default function PayPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const { t } = useLocale();
  const [v, setV] = useState<PspView | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/psp/${ref}`).then((r) => r.json()).then((d) => setV(d.error ? null : d));
  }, [ref]);

  async function act(action: "approve" | "fail") {
    setBusy(true);
    const r = await fetch(`/api/public/psp/${ref}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return;
    setDone(d.status);
    setV((prev) => (prev ? { ...prev, status: d.status, authCode: d.authCode } : prev));
    const number = search.get("number") ?? d.order?.number ?? "";
    const phone = search.get("phone") ?? "";
    setTimeout(() => {
      if (d.status === "paid") router.push(`/shop/confirm?number=${number}&phone=${encodeURIComponent(phone)}`);
      else router.push(`/shop/order/${number}?phone=${encodeURIComponent(phone)}`);
    }, 900);
  }

  if (!v) return <Skeleton className="h-64" />;
  const settled = v.status === "paid" || v.status === "failed" || v.status === "refunded";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Card className="flex flex-col items-center gap-3 text-center">
        <CreditCard className="h-10 w-10 text-accent" />
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("pay.psp")}</p>
        <h1 className="text-xl font-extrabold">{v.storeName ?? ""}</h1>
        <p className="text-sm text-text-muted">{t("pay.order")} <span className="ltr-island font-mono font-bold">{v.order?.number}</span></p>
        <p className="text-3xl font-extrabold"><Price minor={v.amountMinor} /></p>
        <p className="ltr-island text-xs text-text-muted">{v.pspRef}{v.authCode ? ` — auth ${v.authCode}` : ""}</p>
        {v.status === "paid" && <p className="flex items-center gap-1 font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> {t("pay.paid")}</p>}
        {v.status === "failed" && <p className="flex items-center gap-1 font-semibold text-danger"><XCircle className="h-4 w-4" /> {t("pay.failed")}</p>}
        {!settled && (
          <div className="mt-2 flex w-full gap-2">
            <Button className="flex-1" loading={busy} onClick={() => act("approve")}>{t("pay.approve")}</Button>
            <Button variant="secondary" className="flex-1" loading={busy} onClick={() => act("fail")}>{t("pay.decline")}</Button>
          </div>
        )}
        {done && <p className="text-xs text-text-muted">{t("pay.redirecting")}</p>}
      </Card>
    </div>
  );
}
