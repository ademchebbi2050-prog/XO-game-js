"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { useStore } from "@/components/store-provider";
import { useLocale } from "@/components/locale-provider";
import { Button, Skeleton, Price, Badge } from "@/components/ui";
import { addToCart } from "@/lib/cart";

type Product = { id: string; name: string; description: string; priceMinor: number; stock: number; imageUrl: string | null; category: { name: string; slug: string } | null };

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { slug } = useStore();
  const { t } = useLocale();
  const router = useRouter();
  const [p, setP] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    fetch(`/api/public/stores/${slug}/products/${id}`).then((r) => r.json()).then((d) => setP(d.product ?? null));
  }, [slug, id]);

  if (!p) return <Skeleton className="h-72" />;
  const out = p.stock <= 0;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/shop" className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-accent">
        <ChevronLeft className="h-4 w-4 flip-rtl" /> {t("store.backToStore")}
      </Link>
      {p.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imageUrl} alt={p.name} className="aspect-[4/3] w-full rounded-lg object-cover" />
      )}
      <h1 className="text-2xl font-extrabold">{p.name}</h1>
      {p.category && <Link href={`/shop/category/${p.category.slug}`} className="w-fit rounded-pill bg-surface-subtle px-3 py-1 text-xs font-semibold">{p.category.name}</Link>}
      <p className="text-lg font-extrabold"><Price minor={p.priceMinor} /></p>
      {p.description && <p className="whitespace-pre-line text-sm text-text-muted">{p.description}</p>}
      {out ? <Badge tone="danger">{t("store.outOfStock")}</Badge> : (
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-md border border-border-input">
            <button aria-label="-" onClick={() => setQty(Math.max(1, qty - 1))} className="h-11 w-11 text-lg font-bold">−</button>
            <span className="ltr-island w-10 text-center font-bold">{qty}</span>
            <button aria-label="+" onClick={() => setQty(Math.min(p.stock, qty + 1))} className="h-11 w-11 text-lg font-bold">+</button>
          </div>
          <Button
            className="flex-1 sm:flex-none"
            disabled={added}
            onClick={() => {
              addToCart(slug, { productId: p.id, name: p.name, priceMinor: p.priceMinor, qty, imageUrl: p.imageUrl });
              setAdded(true);
              setTimeout(() => router.push("/shop/cart"), 350);
            }}
          >
            <ShoppingCart className="h-4 w-4" /> {added ? t("store.inCart") : t("store.addToCart")}
          </Button>
        </div>
      )}
    </div>
  );
}
