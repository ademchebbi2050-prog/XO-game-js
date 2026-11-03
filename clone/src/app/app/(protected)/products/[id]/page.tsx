"use client";

import { use } from "react";
import { useLocale } from "@/components/locale-provider";
import ProductForm from "../product-form";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("products.edit")}</h1>
      <ProductForm productId={id} />
    </div>
  );
}
