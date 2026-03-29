import AnalyticsCharts from "@/components/admin/AnalyticsCharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsOverview } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const analytics = await getAnalyticsOverview();

  return (
    <div className="min-w-0 space-y-6">
      <section className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="min-w-0 rounded-[28px] border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(14,165,233,0.82))] text-white shadow-xl shadow-slate-900/10">
          <CardHeader>
            <CardDescription className="text-white/70">Business performance</CardDescription>
            <CardTitle className="font-display text-4xl">Track revenue, order status, and client growth in one view.</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-2xl text-sm leading-7 text-white/80">
              Use this page to monitor sales trends, product mix, and account growth over time.
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Snapshot</CardDescription>
            <CardTitle className="font-display text-2xl">At a glance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              Revenue trend points: <span className="font-semibold text-slate-900">{analytics.revenueByMonth.length}</span>
            </p>
            <p>
              Status categories: <span className="font-semibold text-slate-900">{analytics.ordersByStatus.length}</span>
            </p>
            <p>
              Top products tracked: <span className="font-semibold text-slate-900">{analytics.ordersByProduct.length}</span>
            </p>
            <p>
              Client growth months: <span className="font-semibold text-slate-900">{analytics.clientGrowth.length}</span>
            </p>
          </CardContent>
        </Card>
      </section>

      <AnalyticsCharts data={analytics} />
    </div>
  );
}
