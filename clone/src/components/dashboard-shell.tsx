"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Home, ShoppingBag, Package, Truck, Settings, LogOut, Store, Bell, type LucideIcon } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { LangSwitch } from "@/components/ui";

const NAV: { href: string; icon: LucideIcon; key: string; badge?: boolean }[] = [
  { href: "/app/dashboard", icon: Home, key: "nav.home" },
  { href: "/app/orders", icon: ShoppingBag, key: "nav.orders", badge: true },
  { href: "/app/products", icon: Package, key: "nav.products" },
  { href: "/app/delivery", icon: Truck, key: "nav.delivery" },
  { href: "/app/settings", icon: Settings, key: "nav.settings" },
  { href: "/app/notifications", icon: Bell, key: "nav.notifications" }, // M5
];

export default function DashboardShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [store, setStore] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [stores, setStores] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => {
        const list = d.stores ?? [];
        setStores(list);
        const cookie = document.cookie.match(/store_id=([^;]+)/);
        const active = (cookie && list.find((s: { id: string }) => s.id === decodeURIComponent(cookie[1]))) || list[0];
        if (active) {
          setStore(active);
          if (!cookie) document.cookie = `store_id=${active.id}; path=/; samesite=lax`;
        }
      });
    fetch("/api/orders?status=new&limit=1")
      .then((r) => r.json())
      .then((d) => setNewCount(d.total ?? 0))
      .catch(() => {});
  }, []);

  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").replace(/^app\./, "");

  return (
    <div className="min-h-dvh bg-bg">
      {/* TopBar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
        <span className="text-lg font-extrabold text-accent">{t("common.appName")}</span>
        {store && stores.length > 1 ? (
          <select
            aria-label={t("nav.switchStore")}
            className="h-9 max-w-40 truncate rounded-md border border-border-input bg-surface px-2 text-xs font-semibold"
            value={store.id}
            onChange={(e) => {
              document.cookie = `store_id=${e.target.value}; path=/; samesite=lax`;
              window.location.reload();
            }}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          store && (
            <span className="hidden truncate rounded-pill bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-muted sm:inline">
              {store.name}
            </span>
          )
        )}
        <div className="ms-auto flex items-center gap-3">
          <LangSwitch />
          {store && (
            <a
              href={`http://${store.slug}.${rootDomain}`}
              target="_blank"
              rel="noopener"
              className="hidden items-center gap-1 text-sm font-semibold text-accent hover:underline sm:inline-flex"
            >
              <Store className="h-4 w-4" /> {t("nav.viewStore")}
            </a>
          )}
          <span className="hidden text-sm text-text-muted md:inline">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/app/login" })}
            className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold text-text-muted hover:bg-surface-subtle"
            aria-label={t("nav.logout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-56px)] w-60 shrink-0 flex-col gap-1 border-e border-border bg-surface p-3 lg:flex">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold ${
                  active ? "bg-accent-soft text-accent" : "text-text hover:bg-surface-subtle"
                }`}
              >
                <Icon className="h-5 w-5" />
                {t(n.key)}
                {n.badge && newCount > 0 && (
                  <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1.5 text-[11px] font-bold text-white ltr-island">
                    {newCount}
                  </span>
                )}
              </Link>
            );
          })}
        </aside>
        <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 pb-24 lg:pb-8">{children}</main>
      </div>

      {/* BottomNav mobile */}
      <nav className="fixed bottom-0 start-0 end-0 z-20 flex h-14 border-t border-border bg-surface lg:hidden">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                active ? "text-accent" : "text-text-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
              {t(n.key)}
              {n.badge && newCount > 0 && (
                <span className="absolute end-1/4 top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-bold text-white ltr-island">
                  {newCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar desktop */}
      <aside className="fixed start-0 top-14 hidden h-[calc(100dvh-56px)] w-60 flex-col gap-1 border-e border-border bg-surface p-3 lg:flex">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold ${
                active ? "bg-accent-soft text-accent" : "text-text hover:bg-surface-subtle"
              }`}
            >
              <Icon className="h-5 w-5" />
              {t(n.key)}
              {n.badge && newCount > 0 && (
                <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1.5 text-[11px] font-bold text-white ltr-island">
                  {newCount}
                </span>
              )}
            </Link>
          );
        })}
      </aside>
      <div className="lg:ps-60">{/* décale le contenu sous la sidebar */}</div>
    </div>
  );
}
