"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/store-provider";
import { useLocale } from "@/components/locale-provider";
import { Button, Card, ErrorBox, Field, Input, Select, Price } from "@/components/ui";
import { getCart, setCart } from "@/lib/cart";
import { normalizeTnPhone } from "@/lib/phone";
import { GOVERNORATES, governorateLabel, DEFAULT_DELIVERY_FEE_MINOR } from "@/lib/governorates";
import { formatMoney } from "@/lib/money";

export default function CheckoutPage() {
  const { slug } = useStore();
  const { t, locale } = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(getCart(slug));
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [governorate, setGovernorate] = useState("tunis");
  const [address, setAddress] = useState("");
  const [feeMinor, setFeeMinor] = useState<number>(DEFAULT_DELIVERY_FEE_MINOR);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setItems(getCart(slug));
    const onChange = () => setItems(getCart(slug));
    window.addEventListener("cart-changed", onChange);
    return () => window.removeEventListener("cart-changed", onChange);
  }, [slug]);

  useEffect(() => {
    fetch(`/api/public/stores/${slug}/delivery-fee?governorate=${governorate}`)
      .then((r) => r.json())
      .then((d) => setFeeMinor(d.feeMinor ?? DEFAULT_DELIVERY_FEE_MINOR));
  }, [slug, governorate]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.priceMinor * i.qty, 0), [items]);
  const total = subtotal + feeMinor;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const fe: Record<string, string> = {};
    const p = normalizeTnPhone(phone);
    if (!p) { setFieldErrors({ phone: t("common.invalidPhone") }); return; }
    if (!name.trim()) fe.name = t("common.required");
    if (!address.trim()) fe.address = t("common.required");
    setFieldErrors(fe);
    if (Object.keys(fe).length || items.length === 0) return;

    setLoading(true);
    const idemKey = crypto.randomUUID();
    const res = await fetch(`/api/public/stores/${slug}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
      body: JSON.stringify({
        customerName: name.trim(),
        customerPhone: p,
        governorate,
        address: address.trim(),
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.status === 429) { setError(t("checkout.tooManyRequests")); return; }
    if (res.status === 403) { setError(t("checkout.blocked")); return; }
    if (res.status === 409 && d.error === "OUT_OF_STOCK") { setError(t("checkout.outOfStock", { name: d.product ?? "" })); return; }
    if (!res.ok) { setError(t("checkout.invalid")); return; }
    setCart(slug, []);
    router.push(`/shop/confirm?number=${d.order.number}&phone=${encodeURIComponent(p)}`);
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h1 className="text-xl font-bold">{t("checkout.title")}</h1>
      {error && <ErrorBox message={error} />}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <Field label={t("checkout.phone")} error={fieldErrors.phone}>
            <Input required inputMode="tel" dir="ltr" className="ltr-island" placeholder="98 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!fieldErrors.phone} />
          </Field>
          <Field label={t("checkout.name")} error={fieldErrors.name}>
            <Input required value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} />
          </Field>
          <Field label={t("checkout.governorate")}>
            <Select value={governorate} onChange={(e) => setGovernorate(e.target.value)}>
              {GOVERNORATES.map((g) => <option key={g.slug} value={g.slug}>{governorateLabel(g.slug, locale)}</option>)}
            </Select>
          </Field>
          <Field label={t("checkout.address")} error={fieldErrors.address}>
            <Input required value={address} onChange={(e) => setAddress(e.target.value)} aria-invalid={!!fieldErrors.address} />
          </Field>
          <div className="rounded-md bg-surface-subtle p-3 text-sm">
            <p className="font-semibold">{t("checkout.deliveryMethod")}</p>
            <p className="mt-1 flex justify-between"><span>{t("checkout.deliveryFee")}</span><Price minor={feeMinor} /></p>
            <p className="mt-1 font-semibold">{t("checkout.paymentCod")}</p>
          </div>
        </Card>

        <Card className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">{t("checkout.summary")}</p>
          {items.map((i) => (
            <div key={i.productId} className="flex justify-between gap-2">
              <span className="truncate">{i.name} <span className="ltr-island text-text-muted">×{i.qty}</span></span>
              <Price minor={i.priceMinor * i.qty} />
            </div>
          ))}
          <hr className="border-border" />
          <div className="flex justify-between"><span className="text-text-muted">{t("checkout.subtotal")}</span><Price minor={subtotal} /></div>
          <div className="flex justify-between"><span className="text-text-muted">{t("checkout.deliveryFee")}</span><Price minor={feeMinor} /></div>
          <div className="flex justify-between text-base font-extrabold"><span>{t("checkout.total")}</span><Price minor={total} /></div>
        </Card>

        {/* CTA sticky en bas sur mobile */}
        <div className="fixed bottom-0 start-0 end-0 z-10 border-t border-border bg-surface p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <Button type="submit" loading={loading} className="w-full">
            {t("checkout.submit")} — <Price minor={total} />
          </Button>
        </div>
      </form>
    </div>
  );
}
