"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, ErrorBox } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { GOVERNORATES, governorateLabel } from "@/lib/governorates";

type Product = { id: string; name: string; priceMinor: number; stock: number };

export default function NewOrderPage() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [governorate, setGovernorate] = useState("tunis");
  const [address, setAddress] = useState("");
  const [items, setItems] = useState<{ productId: string; qty: number }[]>([{ productId: "", qty: 1 }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName, customerPhone, governorate, address,
        items: items.filter((i) => i.productId).map((i) => ({ productId: i.productId, qty: i.qty })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(t("checkout.invalid")); return; }
    router.push(`/app/orders/${d.order.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("orders.manual.title")}</h1>
      <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        {error && <ErrorBox message={error} />}
        <Field label={t("orders.manual.customerName")}><Input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>
        <Field label={t("orders.manual.customerPhone")} hint="+216"><Input required inputMode="tel" dir="ltr" className="ltr-island" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="98 123 456" /></Field>
        <Field label={t("orders.manual.governorate")}>
          <Select value={governorate} onChange={(e) => setGovernorate(e.target.value)}>
            {GOVERNORATES.map((g) => <option key={g.slug} value={g.slug}>{governorateLabel(g.slug, locale)}</option>)}
          </Select>
        </Field>
        <Field label={t("orders.manual.address")}><Input required value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <Select value={it.productId} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], productId: e.target.value }; setItems(n); }} className="flex-1">
                <option value="">{t("orders.manual.product")}…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stock})</option>)}
              </Select>
              <Input inputMode="numeric" dir="ltr" className="ltr-island w-20" value={it.qty} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], qty: Number(e.target.value) }; setItems(n); }} />
            </div>
          ))}
          <Button variant="ghost" type="button" onClick={() => setItems([...items, { productId: "", qty: 1 }])}>{t("orders.manual.addItem")}</Button>
        </div>
        <Button type="submit" loading={loading}>{t("orders.manual.submit")}</Button>
      </form>
    </div>
  );
}
