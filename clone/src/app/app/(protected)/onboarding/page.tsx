"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, ErrorBox } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";

export default function OnboardingPage() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<"fr" | "ar">(locale);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").replace(/^app\./, "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, locale: defaultLocale }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(
        d.error === "SLUG_TAKEN" ? t("onboarding.slugTaken")
        : d.error === "SLUG_RESERVED" ? t("onboarding.slugReserved")
        : d.error === "SLUG_INVALID" ? "a-z, 0-9, -" : t("common.error")
      );
      return;
    }
    document.cookie = `store_id=${d.store.id}; path=/; samesite=lax`;
    router.push("/app/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h1 className="text-xl font-bold">{t("onboarding.title")}</h1>
        <p className="text-sm text-text-muted">{t("onboarding.step1Hint")}</p>
        {error && <ErrorBox message={error} />}
        <Field label={t("onboarding.storeName")}>
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma Boutique" />
        </Field>
        <Field label={t("onboarding.storeSlug")} hint={`${t("onboarding.slugPreview")} ${slug || "…"}.${rootDomain}`}>
          <Input required pattern="[a-z0-9-]+" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="ma-boutique" dir="ltr" className="ltr-island" />
        </Field>
        <Field label={t("onboarding.locale")}>
          <Select value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value as "fr" | "ar")}>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </Select>
        </Field>
        <Button type="submit" loading={loading}>{t("onboarding.submit")}</Button>
      </form>
    </div>
  );
}
