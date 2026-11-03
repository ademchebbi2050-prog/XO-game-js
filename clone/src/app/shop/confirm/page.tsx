"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { LinkButton } from "@/components/ui";

export default function ConfirmPage() {
  const { t } = useLocale();
  const params = useSearchParams();
  const number = params.get("number") ?? "";
  const phone = params.get("phone") ?? "";
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <CheckCircle2 className="h-14 w-14 text-success" />
      <h1 className="text-2xl font-extrabold">{t("track.thanks")}</h1>
      <p className="text-sm text-text-muted">{t("confirm.hint")}</p>
      <p className="rounded-md bg-surface-subtle px-4 py-2 font-mono text-lg font-bold ltr-island">{number}</p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <LinkButton href={`/shop/order/${number}?phone=${encodeURIComponent(phone)}`} variant="primary">{t("confirm.track")}</LinkButton>
        <LinkButton href="/shop" variant="secondary">{t("confirm.back")}</LinkButton>
      </div>
    </div>
  );
}
