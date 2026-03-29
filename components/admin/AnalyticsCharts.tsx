"use client";

import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { AnalyticsOverview } from "@/lib/admin/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AnalyticsChartsProps = {
  data: AnalyticsOverview;
};

const palette = ["#0f766e", "#0ea5e9", "#f97316", "#16a34a", "#475569", "#eab308"];

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  return (
    <div className="min-w-0 space-y-6">
      <section className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-w-0 rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Revenue trend</CardDescription>
            <CardTitle className="font-display text-2xl">Monthly commercial signal</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] min-h-[320px] min-w-0">
            <div className="h-full min-h-[320px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={320} debounce={50}>
                <AreaChart data={data.revenueByMonth}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                  <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                  <Area type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Status mix</CardDescription>
            <CardTitle className="font-display text-2xl">Operational balance</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] min-h-[320px] min-w-0">
            <div className="h-full min-h-[320px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={320} debounce={50}>
                <PieChart>
                  <Pie data={data.ordersByStatus} dataKey="value" nameKey="label" innerRadius={68} outerRadius={102} paddingAngle={4}>
                    {data.ordersByStatus.map((entry, index) => (
                      <Cell key={entry.label} fill={palette[index % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Product mix</CardDescription>
            <CardTitle className="font-display text-2xl">What clients are buying</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] min-h-[320px] min-w-0">
            <div className="h-full min-h-[320px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={320} debounce={50}>
                <BarChart data={data.ordersByProduct}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[14, 14, 0, 0]} fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Client growth</CardDescription>
            <CardTitle className="font-display text-2xl">Acquisition rhythm</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] min-h-[320px] min-w-0">
            <div className="h-full min-h-[320px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={320} debounce={50}>
                <BarChart data={data.clientGrowth}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[14, 14, 0, 0]} fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
