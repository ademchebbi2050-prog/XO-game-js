"use client";

import { useLocale } from "@/components/locale-provider";
import ProductForm from "../product-form";

export default function NewProductPage() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("products.new")}</h1>
      <ProductForm />
    </div>
  );
}
