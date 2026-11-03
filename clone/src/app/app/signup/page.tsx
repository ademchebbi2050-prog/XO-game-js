"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Field, Input, ErrorBox, LangSwitch } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";

export default function SignupPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(d.error === "EMAIL_TAKEN" ? t("auth.emailTaken") : d.error === "PHONE_INVALID" ? t("common.invalidPhone") : t("common.error"));
      return;
    }
    const si = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    setLoading(false);
    if (si?.error) {
      router.push("/app/login");
      return;
    }
    router.push("/app/onboarding");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-accent">{t("common.appName")}</h1>
          <LangSwitch />
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-bold">{t("auth.signupTitle")}</h2>
          {error && <ErrorBox message={error} />}
          <Field label={t("auth.name")}>
            <Input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("auth.email")}>
            <Input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label={t("auth.phone")} hint="+216">
            <Input inputMode="tel" autoComplete="tel" placeholder="98 123 456" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={t("auth.password")}>
            <Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Button type="submit" loading={loading}>{t("auth.signupSubmit")}</Button>
          <p className="text-center text-sm text-text-muted">
            <Link href="/app/login" className="font-semibold text-accent hover:underline">{t("auth.toLogin")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
