"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Package, FolderPlus } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Badge, EmptyState, Skeleton, Price, Button, Input } from "@/components/ui";

type Product = { id: string; name: string; priceMinor: number; stock: number; imageUrl: string | null; isActive: boolean; category: { name: string } | null };
type Category = { id: string; name: string; slug: string };

export default function ProductsPage() {
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState("");
  const [catMsg, setCatMsg] = useState("");

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? []));
  }, []);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatMsg("");
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCat }),
    });
    if (res.ok) {
      const d = await res.json();
      setCategories((c) => [...c, d.category]);
      setNewCat("");
      setCatMsg(t("products.categoryCreated"));
    } else {
      setCatMsg(t("products.categoryError"));
    }
  }

  useEffect(() => {
    const h = setTimeout(() => {
      fetch(`/api/products?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setProducts(d.products ?? []));
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{t("products.title")}</h1>
        <Link href="/app/products/new"><Button><Plus className="h-4 w-4" />{t("products.new")}</Button></Link>
      </div>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("common.search")}
          className="h-11 w-full rounded-md border border-border-input bg-surface ps-9 pe-3 text-base"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <span key={c.id} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
            {c.name}
          </span>
        ))}
        <form onSubmit={createCategory} className="flex items-center gap-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder={t("products.newCategory")}
            className="h-9 w-44"
            aria-label={t("products.newCategory")}
          />
          <Button type="submit" variant="secondary" className="h-9"><FolderPlus className="h-4 w-4" />{t("products.addCategory")}</Button>
        </form>
        {catMsg && <p className="text-sm text-text-muted">{catMsg}</p>}
      </div>
      {!products && <Skeleton className="h-40" />}
      {products && products.length === 0 && (
        <EmptyState title={t("products.emptyTitle")} hint={t("products.emptyHint")} action={<Link href="/app/products/new"><Button>{t("products.new")}</Button></Link>} />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((p) => (
          <Link key={p.id} href={`/app/products/${p.id}`} className="flex gap-3 rounded-lg border border-border bg-surface p-3 shadow-card hover:bg-surface-subtle">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-surface-subtle text-text-muted"><Package className="h-6 w-6" /></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="text-sm font-bold"><Price minor={p.priceMinor} /></p>
              <div className="mt-1 flex gap-1">
                {p.stock === 0 ? <Badge tone="danger">{t("products.outOfStock")}</Badge>
                  : p.stock <= 5 ? <Badge tone="warning">{t("products.lowStock")}</Badge> : null}
                {!p.isActive && <Badge>{t("settings.draft")}</Badge>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
