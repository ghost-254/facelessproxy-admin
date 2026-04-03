"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, Mail, Menu, PackageCheck, Users2, X } from "lucide-react";

import type { AdminSessionUser } from "@/lib/auth/server";
import { cn } from "@/lib/utils";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";

type AdminShellProps = {
  admin: AdminSessionUser;
  children: React.ReactNode;
};

const navigation = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: PackageCheck },
  { href: "/admin/clients", label: "Clients", icon: Users2 },
  { href: "/admin/emails", label: "Campaigns", icon: Mail },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/admin/orders")) {
    return {
      title: pathname.includes("fulfill") ? "Fulfillment Desk" : "Order Command",
      description: "Track pipeline health, inspect orders, and complete delivery flows.",
    };
  }

  if (pathname.startsWith("/admin/clients")) {
    return {
      title: "Client Intelligence",
      description: "Review account growth, segment outreach, and keep retention moving.",
    };
  }

  if (pathname.startsWith("/admin/analytics")) {
    return {
      title: "Revenue Signal",
      description: "Watch commercial trends, product mix, and client momentum in one place.",
    };
  }

  if (pathname.startsWith("/admin/emails")) {
    return {
      title: "Email Campaigns",
      description: "Launch branded campaigns to all clients or send personalized outreach to one recipient.",
    };
  }

  return {
    title: "Admin Dashboard",
    description: "Manage orders, clients, fulfillment, and reporting from one place.",
  };
}

function initials(value?: string | null) {
  const source = value?.trim();
  if (!source) {
    return "FP";
  }

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function AdminShell({ admin, children }: AdminShellProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pageMeta = useMemo(() => getPageMeta(pathname), [pathname]);

  return (
    <div className="relative h-screen overflow-hidden bg-[linear-gradient(180deg,#f8f4ec_0%,#eef5f3_48%,#f4f7fb_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.14),transparent_24%)]" />
      <div className="hero-grid absolute inset-0 opacity-40" />

      <div className="relative mx-auto flex h-full max-w-[1600px] gap-4 px-3 py-3 md:gap-6 md:px-6 md:py-6">
        {isMobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation"
          />
        ) : null}

        <aside
          className={cn(
            "glass-panel fixed inset-y-3 left-3 z-40 flex w-[290px] flex-col overflow-y-auto overscroll-contain rounded-[28px] border-white/80 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.14)] transition-transform duration-300 lg:static lg:h-full lg:translate-x-0",
            isMobileOpen ? "translate-x-0" : "-translate-x-[120%]",
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Faceless Proxy</p>
              <h1 className="font-display text-2xl font-semibold text-slate-950">Admin</h1>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-600 lg:hidden"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-8 rounded-[24px] border border-slate-200/70 bg-slate-950 px-5 py-4 text-white shadow-lg shadow-slate-900/10">
            <p className="text-xs uppercase tracking-[0.24em] text-white/60">Access</p>
            <p className="mt-2 font-display text-xl font-semibold">{admin.name || "Admin operator"}</p>
            <p className="mt-1 text-sm text-white/70">{admin.email || "Secure Firebase session"}</p>
          </div>

          <nav className="mt-8 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-slate-950 text-white shadow-lg shadow-slate-900/10"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-950",
                  )}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[24px] border border-white/70 bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Security mode</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Session cookies are verified on the server before admin routes and protected actions load.
            </p>
            <div className="mt-4">
              <AdminSignOutButton />
            </div>
          </div>
        </aside>

        <div className="min-h-0 min-w-0 flex-1">
          <div className="glass-panel flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border-white/80 shadow-[0_28px_90px_rgba(15,23,42,0.14)]">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/70 px-5 py-5 md:px-8">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-700 lg:hidden"
                  onClick={() => setIsMobileOpen(true)}
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Admin Panel</p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-950">
                    {pageMeta.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{pageMeta.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-right md:block">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Session</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{admin.email || "Admin access"}</p>
                </div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                  {initials(admin.name || admin.email)}
                </div>
                <div className="lg:hidden">
                  <AdminSignOutButton compact />
                </div>
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-8 md:py-8">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
