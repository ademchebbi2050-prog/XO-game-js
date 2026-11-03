"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/store-provider";
import { useLocale } from "@/components/locale-provider";
import { Skeleton, Price, EmptyState } from "@/components/ui";

type Product = { id: string; name: string; priceMinor: number; stock: number; imageUrl: string | null };

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { slug: storeSlug } = useStore();
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    fetch(`/api/public/stores/${storeSlug}/products?category=${slug}`).then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  }, [storeSlug, slug]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold capitalize">{slug}</h1>
      {!products && <Skeleton className="h-40" />}
      {products && products.length === 0 && <EmptyState title={t("store.emptyStore")} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products?.map((p) => (
          <Link key={p.id} href={`/shop/product/${p.id}`} className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <div className="flex aspect-[4/3] items-center justify-center bg-surface-subtle text-text-muted">{p.name.slice(0, 1)}</div>
            <div className="flex flex-col gap-1 p-3">
              <p className="line-clamp-2 text-sm font-semibold">{p.name}</p>
              <p className="text-sm font-extrabold"><Price minor={p.priceMinor} /></p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
