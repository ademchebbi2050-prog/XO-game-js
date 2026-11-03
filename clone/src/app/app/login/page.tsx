"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Field, Input, ErrorBox, LangSwitch } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";

export default function LoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError(t("auth.badCredentials"));
      return;
    }
    router.push("/app/dashboard");
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
          <h2 className="text-lg font-bold">{t("auth.loginTitle")}</h2>
          {error && <ErrorBox message={error} />}
          <Field label={t("auth.email")}>
            <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t("auth.password")}>
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" loading={loading}>{t("auth.loginSubmit")}</Button>
          <p className="text-center text-sm text-text-muted">
            <Link href="/app/signup" className="font-semibold text-accent hover:underline">{t("auth.toSignup")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
