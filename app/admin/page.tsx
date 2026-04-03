import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardOverview } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusVariant(status: string) {
  if (status === "fulfilled" || status === "paid") {
    return "success" as const;
  }

  if (status === "pending") {
    return "warning" as const;
  }

  if (status === "unpaid") {
    return "destructive" as const;
  }

  return "default" as const;
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin("/admin");
  const dashboard = await getDashboardOverview(admin);
  const maxRevenue = Math.max(...dashboard.revenueSeries.map((entry) => entry.revenue), 1);
  const totalPipeline = Math.max(dashboard.pipeline.reduce((sum, item) => sum + item.value, 0), 1);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[28px] border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,118,110,0.88))] text-white shadow-xl shadow-slate-900/10">
          <CardHeader>
            <CardDescription className="text-white/70">Ops snapshot</CardDescription>
            <CardTitle className="font-display text-4xl leading-tight">
              Welcome back, {dashboard.admin.name || dashboard.admin.email || "operator"}.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="max-w-2xl text-sm leading-7 text-white/80">
              Review activity, monitor order flow, and handle daily admin work from a single dashboard.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-2xl bg-white text-slate-950 hover:bg-white/90">
                <Link href="/admin/orders">
                  Open order queue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/admin/emails">Launch campaigns</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/admin/analytics">Review analytics</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Seven-day revenue pulse</CardDescription>
            <CardTitle className="font-display text-2xl">Momentum at a glance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.revenueSeries.map((entry) => (
              <div key={entry.label} className="grid grid-cols-[72px_1fr_auto] items-center gap-3">
                <p className="text-sm text-slate-500">{entry.label}</p>
                <div className="h-3 rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-teal-700 to-sky-500"
                    style={{ width: `${Math.max((entry.revenue / maxRevenue) * 100, entry.revenue > 0 ? 8 : 0)}%` }}
                  />
                </div>
                <p className="text-sm font-medium text-slate-900">{formatCurrency(entry.revenue)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <Card key={metric.label} className="rounded-[28px] border-white/80 bg-white/80">
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="font-display text-3xl">{metric.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={metric.tone === "success" ? "success" : metric.tone === "warning" ? "warning" : "secondary"}>
                {metric.delta}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Pipeline</CardDescription>
            <CardTitle className="font-display text-2xl">Where the queue stands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.pipeline.map((entry) => (
              <div key={entry.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{entry.label}</span>
                  <span className="font-medium text-slate-900">{entry.value}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-slate-950"
                    style={{ width: `${Math.max((entry.value / totalPipeline) * 100, entry.value > 0 ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardDescription>Recent orders</CardDescription>
              <CardTitle className="font-display text-2xl">Latest commercial movement</CardTitle>
            </div>
            <Button asChild variant="outline" className="rounded-2xl border-white/70 bg-white/80">
              <Link href="/admin/orders">See full queue</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{order.id}</p>
                        <p className="text-xs text-slate-500">{order.customerEmail || "Unknown client"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{order.proxyType}</TableCell>
                    <TableCell>{formatCurrency(order.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(order.status)} className="capitalize">
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
