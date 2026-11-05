"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useStore } from "@/components/store-provider";
import { useLocale } from "@/components/locale-provider";
import { Button, EmptyState, Price, Card } from "@/components/ui";
import { getCart, setQty, removeFromCart, type CartItem } from "@/lib/cart";

export default function CartPage() {
  const { slug } = useStore();
  const { t } = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart(slug));
    const onChange = () => setItems(getCart(slug));
    window.addEventListener("cart-changed", onChange);
    return () => window.removeEventListener("cart-changed", onChange);
  }, [slug]);

  const subtotal = items.reduce((s, i) => s + i.priceMinor * i.qty, 0);

  if (items.length === 0) {
    return (
      <EmptyState title={t("cart.empty")} action={<Link href="/shop"><Button variant="secondary">{t("cart.continue")}</Button></Link>} />
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <h1 className="text-xl font-bold">{t("cart.title")}</h1>
      <div className="flex flex-col gap-2">
        {items.map((i) => (
          <Card key={`${i.productId}::${i.variantId ?? ""}`} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{i.name}</p>
              <p className="text-xs text-text-muted"><Price minor={i.priceMinor} /></p>
            </div>
            <div className="flex items-center rounded-md border border-border-input">
              <button aria-label="-" onClick={() => setQty(slug, i.productId, i.qty - 1, i.variantId)} className="h-10 w-10 font-bold">−</button>
              <span className="ltr-island w-8 text-center text-sm font-bold">{i.qty}</span>
              <button aria-label="+" onClick={() => setQty(slug, i.productId, i.qty + 1, i.variantId)} className="h-10 w-10 font-bold">+</button>
            </div>
            <Price minor={i.priceMinor * i.qty} className="text-sm font-bold" />
            <button aria-label={t("cart.remove")} onClick={() => removeFromCart(slug, i.productId, i.variantId)} className="h-10 w-10 text-danger">
              <Trash2 className="mx-auto h-4 w-4" />
            </button>
          </Card>
        ))}
      </div>
      <Card className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t("checkout.subtotal")}</span>
        <Price minor={subtotal} className="text-base font-extrabold" />
      </Card>
      {/* CTA sticky mobile */}
      <div className="fixed bottom-0 start-0 end-0 border-t border-border bg-surface p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <Button className="w-full" onClick={() => router.push("/shop/checkout")}>
          {t("cart.checkout")} — <Price minor={subtotal} />
        </Button>
      </div>
    </div>
  );
}
