import { redirect } from "next/navigation";
import { ShieldCheck, Sparkles, Waypoints } from "lucide-react";

import AdminLoginForm from "@/components/auth/AdminLoginForm";
import { getCurrentAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    reason?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const admin = await getCurrentAdmin();
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : "/admin";

  if (admin) {
    redirect(nextPath);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8f4ec_0%,#eef5f3_45%,#f4f7fb_100%)] px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(18,133,118,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.16),transparent_28%)]" />
      <div className="hero-grid absolute inset-0 opacity-60" />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-teal-700" />
            Faceless Proxy operations access
          </div>

          <div className="max-w-2xl space-y-6">
            <p className="font-display text-5xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Run the admin side with a cleaner cockpit and stricter access control.
            </p>
            <p className="max-w-xl text-lg leading-8 text-slate-600">
              Sign in to manage orders, clients, fulfillment, and reporting from one secure admin panel.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass-panel rounded-3xl p-5">
              <Sparkles className="mb-3 h-5 w-5 text-amber-500" />
              <p className="font-display text-lg font-semibold text-slate-900">Clearer layout</p>
              <p className="mt-2 text-sm text-slate-600">A cleaner structure for day-to-day admin work.</p>
            </div>
            <div className="glass-panel rounded-3xl p-5">
              <ShieldCheck className="mb-3 h-5 w-5 text-teal-700" />
              <p className="font-display text-lg font-semibold text-slate-900">Secure access</p>
              <p className="mt-2 text-sm text-slate-600">Admin routes are protected by server-validated sessions.</p>
            </div>
            <div className="glass-panel rounded-3xl p-5">
              <Waypoints className="mb-3 h-5 w-5 text-sky-600" />
              <p className="font-display text-lg font-semibold text-slate-900">Connected workflow</p>
              <p className="mt-2 text-sm text-slate-600">Orders, clients, and analytics now live in one consistent workspace.</p>
            </div>
          </div>
        </section>

        <AdminLoginForm
          nextPath={nextPath}
          reason={typeof params.reason === "string" ? params.reason : undefined}
        />
      </div>
    </main>
  );
}
