"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { formatMoney } from "@/lib/money";
import type { OrderStatus } from "@/generated/prisma/client";

// ---------- Button ----------
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className = "",
  loading = false,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  const base =
    "inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors duration-base ease-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-accent text-on-accent hover:bg-accent-hover",
    secondary: "border border-border bg-surface text-text hover:bg-surface-subtle",
    ghost: "text-accent hover:bg-accent-soft",
    danger: "bg-danger text-white hover:opacity-90",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "secondary",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  const base =
    "inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors duration-base ease-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-accent text-on-accent hover:bg-accent-hover",
    secondary: "border border-border bg-surface text-text hover:bg-surface-subtle",
    ghost: "text-accent hover:bg-accent-soft",
    danger: "bg-danger text-white hover:opacity-90",
  };
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

// ---------- Field / Input ----------
export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-text">{label}</label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-md border border-border-input bg-surface px-3 text-base text-text placeholder:text-text-muted transition-colors duration-fast focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-surface-subtle aria-[invalid=true]:border-danger";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputCls} {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputCls} h-auto min-h-24 py-2`} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputCls} appearance-none`} {...props} />
  );
}

// ---------- Badges ----------
const STATUS_CLASS: Record<OrderStatus, string> = {
  new: "bg-status-new-soft text-status-new",
  to_confirm: "bg-status-to-confirm-soft text-status-to-confirm",
  unreachable: "bg-status-unreachable-soft text-status-unreachable",
  confirmed: "bg-status-confirmed-soft text-status-confirmed",
  shipped: "bg-status-shipped-soft text-status-shipped",
  delivered: "bg-status-delivered-soft text-status-delivered",
  returned: "bg-status-returned-soft text-status-returned",
  cancelled: "bg-status-cancelled-soft text-status-cancelled",
};

export function StatusPill({ status, label }: { status: OrderStatus; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font600 font-semibold ${STATUS_CLASS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label ?? status}
    </span>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger"; children: ReactNode }) {
  const tones = {
    neutral: "bg-surface-subtle text-text-muted",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

// ---------- Card / states ----------
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-lg border border-border bg-surface p-4 shadow-card ${className}`}>{children}</div>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-subtle ${className}`} aria-hidden />;
}

export function ErrorBox({ message }: { message: string }) {
  return <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{message}</p>;
}

// ---------- Divers ----------
export function Price({ minor, className = "" }: { minor: number; className?: string }) {
  const { locale } = useLocale();
  return <span className={`ltr-island ${className}`}>{formatMoney(minor, locale)}</span>;
}

export function PhoneLink({ phone, className = "" }: { phone: string; className?: string }) {
  return <span dir="ltr" className={`ltr-island ${className}`}>{phone}</span>;
}

export function LangSwitch() {
  const { locale } = useLocale();
  const other = locale === "fr" ? "ar" : "fr";
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        document.cookie = `locale=${other}; path=/; max-age=31536000; samesite=lax`;
        location.reload();
      }}
      className="text-sm font-semibold text-accent hover:underline"
    >
      {other === "ar" ? "العربية" : "Français"}
    </a>
  );
}
