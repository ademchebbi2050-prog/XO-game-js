"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { useStore } from "@/components/store-provider";
import { useLocale } from "@/components/locale-provider";
import { EmptyState, Skeleton, Price, Badge } from "@/components/ui";

type Product = { id: string; name: string; description: string; priceMinor: number; stock: number; imageUrl: string | null; category: { name: string; slug: string } | null };

export default function ShopHome() {
  const { slug } = useStore();
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [cats, setCats] = useState<{ name: string; slug: string }[]>([]);

  useEffect(() => {
    fetch(`/api/public/stores/${slug}`).then((r) => r.json()).then((d) => setCats(d.categories ?? []));
    fetch(`/api/public/stores/${slug}/products`).then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  }, [slug]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t("store.allProducts")}</h1>
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <Link key={c.slug} href={`/shop/category/${c.slug}`} className="rounded-pill bg-surface-subtle px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft">
              {c.name}
            </Link>
          ))}
        </div>
      )}
      {!products && <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>}
      {products && products.length === 0 && <EmptyState title={t("store.emptyStore")} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products?.map((p) => (
          <Link key={p.id} href={`/shop/product/${p.id}`} className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card hover:bg-surface-subtle">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={p.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-surface-subtle text-text-muted"><Package className="h-8 w-8" /></div>
            )}
            <div className="flex flex-col gap-1 p-3">
              <p className="line-clamp-2 text-sm font-semibold">{p.name}</p>
              <p className="text-sm font-extrabold"><Price minor={p.priceMinor} /></p>
              {p.stock === 0 && <Badge tone="danger">{t("store.outOfStock")}</Badge>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
