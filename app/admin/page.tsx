// app/admin/page.tsx (Updated with header and fulfilled orders filter)
import AdminHeader from "@/components/admin/Header"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore"
import { db } from "@/lib/firebaseConfig"
import { DollarSign, ShoppingCart, CheckCircle2, TrendingUp, Eye, ArrowRight } from "lucide-react"

async function getRecentOrders() {
  const q = query(
    collection(db, "orders"),
    where("status", "==", "fulfilled"),
    orderBy("createdAt", "desc"),
    limit(10)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    proxyType: doc.data().orderDetails?.proxyType || doc.data().proxyType || "N/A",
    total: doc.data().totalAmount || doc.data().finalTotal || doc.data().totalPrice || 0,
    status: doc.data().paymentStatus || doc.data().status || "unknown",
  }))
}

async function getStats() {
  const q = query(collection(db, "orders"), where("status", "==", "fulfilled"))
  const snapshot = await getDocs(q)
  const orders = snapshot.docs.map(doc => doc.data())

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || o.finalTotal || o.totalPrice || 0), 0)
  const totalOrders = orders.length
  const paidOrders = orders.filter(o => o.paymentStatus === "paid" || o.status === "paid").length

  return { totalRevenue, totalOrders, paidOrders }
}

export default async function AdminDashboard() {
  const [recentOrders, stats] = await Promise.all([getRecentOrders(), getStats()])

  return (
    <>
      <AdminHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Button asChild>
            <Link href="/admin/orders">
              View All Orders <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-slate-500">From fulfilled orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fulfilled Orders</CardTitle>
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-slate-500">Completed sales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Paid Fulfilled</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.paidOrders}</div>
              <p className="text-xs text-slate-500">Successful payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalOrders > 0 ? ((stats.paidOrders / stats.totalOrders) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-slate-500">Paid / Fulfilled</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Fulfilled Orders</CardTitle>
            <CardDescription>Last 10 fulfilled orders</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.id.slice(0, 12)}...</TableCell>
                    <TableCell>{order.proxyType}</TableCell>
                    <TableCell>${Number(order.total).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={order.status === "paid" ? "success" : order.status === "pending" ? "warning" : "destructive"}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/admin/orders/fulfill-order?id=${order.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}