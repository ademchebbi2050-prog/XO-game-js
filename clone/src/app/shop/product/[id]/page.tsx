"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { useStore } from "@/components/store-provider";
import { useLocale } from "@/components/locale-provider";
import { Button, Skeleton, Price, Badge } from "@/components/ui";
import { addToCart } from "@/lib/cart";

type Variant = { id: string; label: string; priceDeltaMinor: number; stock: number };
type Product = { id: string; name: string; description: string; priceMinor: number; stock: number; imageUrl: string | null; category: { name: string; slug: string } | null; variants?: Variant[] }; // M5

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { slug } = useStore();
  const { t } = useLocale();
  const router = useRouter();
  const [p, setP] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null); // M5

  useEffect(() => {
    fetch(`/api/public/stores/${slug}/products/${id}`).then((r) => r.json()).then((d) => setP(d.product ?? null));
  }, [slug, id]);

  if (!p) return <Skeleton className="h-72" />;
  // M5: variante active sélectionnée (prix = base + delta, stock de la variante)
  const variants = p.variants ?? [];
  const variant = variants.find((v) => v.id === variantId) ?? null;
  const effectiveStock = variant ? variant.stock : p.stock;
  const effectivePrice = p.priceMinor + (variant?.priceDeltaMinor ?? 0);
  const out = effectiveStock <= 0;

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
      <p className="text-lg font-extrabold"><Price minor={effectivePrice} /></p>
      {/* M5: sélecteur de variantes */}
      {variants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="variants">
          {variants.map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={(variant?.id ?? variants[0].id) === v.id}
              disabled={v.stock <= 0}
              onClick={() => { setVariantId(v.id); setQty(1); }}
              className={`rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-40 ${(variant?.id ?? variants[0].id) === v.id ? "border-accent bg-accent-soft text-accent" : "border-border-input bg-surface"}`}
            >
              {v.label} {v.priceDeltaMinor !== 0 && <span className="ltr-island text-xs">({v.priceDeltaMinor > 0 ? "+" : ""}{(v.priceDeltaMinor / 1000).toFixed(3)} TND)</span>}
              {v.stock <= 0 && <span className="ms-1 text-xs text-danger">({t("store.outOfStock")})</span>}
            </button>
          ))}
        </div>
      )}
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
              const v = variants.find((x) => x.id === (variantId ?? variants[0]?.id)) ?? null; // M5
              addToCart(slug, {
                productId: p.id,
                variantId: v?.id ?? null, // M5
                name: v ? `${p.name} — ${v.label}` : p.name,
                priceMinor: p.priceMinor + (v?.priceDeltaMinor ?? 0),
                qty,
                imageUrl: p.imageUrl,
              });
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
