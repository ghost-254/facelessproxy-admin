// app/admin/analytics/page.tsx (New placeholder page for analytics)
"use client"

import AdminHeader from "@/components/admin/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AnalyticsPage() {
  return (
    <>
      <AdminHeader />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Analytics</h1>
        <Card>
          <CardHeader>
            <CardTitle>Sales Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Coming soon: Charts for total sales, trends, etc.</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}