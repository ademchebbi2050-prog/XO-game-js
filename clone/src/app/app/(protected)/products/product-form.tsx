"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, Select, ErrorBox } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { inputToMinor } from "@/lib/money";

type Category = { id: string; name: string };

export default function ProductForm({ productId }: { productId?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: "", description: "", price: "", cost: "", stock: "0", barcode: "", categoryId: "", isActive: true });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCats(d.categories ?? []));
    if (productId) {
      fetch(`/api/products/${productId}`).then((r) => r.json()).then((d) => {
        const p = d.product;
        if (p) {
          setForm({
            name: p.name, description: p.description, price: (p.priceMinor / 1000).toString(),
            cost: p.costMinor != null ? (p.costMinor / 1000).toString() : "", stock: String(p.stock),
            barcode: p.barcode ?? "", categoryId: p.categoryId ?? "", isActive: p.isActive,
          });
          setImageUrl(p.imageUrl);
        }
      });
    }
  }, [productId]);

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (res.ok) setImageUrl(d.url);
    else setError(d.error === "IMAGE_TOO_LARGE" ? "5 Mo max" : t("common.error"));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const priceMinor = inputToMinor(form.price);
    if (!form.name.trim() || priceMinor === null) { setError(t("checkout.invalid")); return; }
    setLoading(true);
    const payload = {
      name: form.name, description: form.description, priceMinor,
      costMinor: form.cost ? inputToMinor(form.cost) : null,
      stock: Number(form.stock || 0), barcode: form.barcode || null,
      categoryId: form.categoryId || null, imageUrl, isActive: form.isActive,
    };
    const res = await fetch(productId ? `/api/products/${productId}` : "/api/products", {
      method: productId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) { setError(t("common.error")); return; }
    router.push("/app/products");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
      {error && <ErrorBox message={error} />}
      <Field label={t("products.name")}><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label={t("products.description")}><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("products.price")}><Input required inputMode="decimal" dir="ltr" className="ltr-island" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="79,000" /></Field>
        <Field label={t("products.cost")}><Input inputMode="decimal" dir="ltr" className="ltr-island" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("products.stock")}><Input required inputMode="numeric" dir="ltr" className="ltr-island" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
        <Field label={t("products.barcode")}><Input dir="ltr" className="ltr-island" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
      </div>
      <Field label={t("products.category")}>
        <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
          <option value="">—</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label={t("products.image")} hint={t("products.imageHint")}>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={onImage} className="text-sm" />
        {imageUrl && <img src={imageUrl} alt="" className="h-24 w-24 rounded-md object-cover" />}
      </Field>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-5 w-5" />
        {t("products.active")}
      </label>
      <Button type="submit" loading={loading}>{t("products.save")}</Button>
    </form>
  );
}
