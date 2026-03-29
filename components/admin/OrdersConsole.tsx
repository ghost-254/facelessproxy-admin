"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Search, Trash2 } from "lucide-react";

import type { AdminOrderSummary } from "@/lib/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

type OrdersConsoleProps = {
  initialOrders: AdminOrderSummary[];
};

const PAGE_SIZE = 12;

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

  if (status === "unpaid" || status === "failed" || status === "cancelled") {
    return "destructive" as const;
  }

  return "default" as const;
}

export default function OrdersConsole({ initialOrders }: OrdersConsoleProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeOrder, setActiveOrder] = useState<AdminOrderSummary | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AdminOrderSummary | null>(null);

  const filterOptions = useMemo(() => {
    const products = [...new Set(orders.map((order) => order.proxyType).filter(Boolean))];
    const paymentMethods = [...new Set(orders.map((order) => order.paymentMethod).filter(Boolean))];
    return { products, paymentMethods };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !term ||
        order.id.toLowerCase().includes(term) ||
        order.customerEmail?.toLowerCase().includes(term) ||
        order.proxyType.toLowerCase().includes(term);

      const matchesStatus = statusFilter === "all" || order.status === statusFilter || order.paymentStatus === statusFilter;
      const matchesProduct = productFilter === "all" || order.proxyType === productFilter;
      const matchesPayment = paymentFilter === "all" || order.paymentMethod === paymentFilter;

      return matchesSearch && matchesStatus && matchesProduct && matchesPayment;
    });
  }, [orders, paymentFilter, productFilter, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const summary = useMemo(() => {
    const gross = filteredOrders.reduce((sum, order) => sum + order.amount, 0);
    const pending = filteredOrders.filter((order) => order.status === "pending" || order.paymentStatus === "pending").length;
    const special = filteredOrders.filter((order) => order.isSpecialProxy).length;

    return { gross, pending, special };
  }, [filteredOrders]);

  async function handleDelete() {
    if (!deleteCandidate) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/orders/${deleteCandidate.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete that order.");
      }

      setOrders((current) => current.filter((order) => order.id !== deleteCandidate.id));
      setDeleteCandidate(null);
      toast({
        title: "Order removed",
        description: "The selected order was deleted from the admin record.",
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unable to delete that order.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function openFulfillment(order: AdminOrderSummary) {
    router.push(order.isSpecialProxy ? `/admin/orders/fulfill-special-proxy?id=${order.id}` : `/admin/orders/fulfill-order?id=${order.id}`);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="rounded-[28px] border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,118,110,0.88))] text-white shadow-xl shadow-slate-900/10">
          <CardHeader>
            <CardDescription className="text-white/70">Order operations</CardDescription>
            <CardTitle className="font-display text-3xl">Review incoming orders and move them through fulfillment.</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-white/70">Orders in scope</p>
              <p className="mt-2 text-3xl font-semibold">{filteredOrders.length}</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-white/70">Filtered gross</p>
              <p className="mt-2 text-3xl font-semibold">{formatCurrency(summary.gross)}</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-white/70">Need follow-up</p>
              <p className="mt-2 text-3xl font-semibold">{summary.pending + summary.special}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Filters</CardDescription>
            <CardTitle className="font-display text-2xl">Find the right slice fast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="Search order, email, or proxy type"
                className="h-12 rounded-2xl border-white/70 bg-white/80 pl-11"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/80">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={productFilter}
                onValueChange={(value) => {
                  setProductFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/80">
                  <SelectValue placeholder="Product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {filterOptions.products.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={paymentFilter}
                onValueChange={(value) => {
                  setPaymentFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/80">
                  <SelectValue placeholder="Payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {filterOptions.paymentMethods.map((payment) => (
                    <SelectItem key={payment} value={payment}>
                      {payment}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[28px] border-white/80 bg-white/80">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardDescription>Order table</CardDescription>
            <CardTitle className="font-display text-2xl">Recent activity and fulfillment shortcuts</CardTitle>
          </div>
          <Button
            variant="outline"
            className="rounded-2xl border-white/70 bg-white/80"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setProductFilter("all");
              setPaymentFilter("all");
              setPage(1);
            }}
          >
            Reset
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{order.id}</p>
                      <p className="text-xs text-slate-500">{order.locationLabel}</p>
                    </div>
                  </TableCell>
                  <TableCell>{order.customerEmail || "Unknown client"}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p>{order.proxyType}</p>
                      <p className="text-xs text-slate-500">{order.quantityLabel}</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(order.amount)}</TableCell>
                  <TableCell>{order.paymentMethod}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(order.status)} className="capitalize">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="rounded-2xl" onClick={() => setActiveOrder(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" className="rounded-2xl" onClick={() => openFulfillment(order)}>
                        Fulfill
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDeleteCandidate(order)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-2xl" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <Button variant="outline" className="rounded-2xl" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(activeOrder)} onOpenChange={(open) => (open ? undefined : setActiveOrder(null))}>
        <DialogContent className="rounded-[28px] border-white/80 bg-white/95 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Order snapshot</DialogTitle>
            <DialogDescription>Quick context before you open the full fulfillment desk.</DialogDescription>
          </DialogHeader>
          {activeOrder ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Identity</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{activeOrder.id}</p>
                <p className="mt-2 text-sm text-slate-600">{activeOrder.customerEmail || "Unknown client"}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Commercial</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{formatCurrency(activeOrder.amount)}</p>
                <p className="mt-2 text-sm text-slate-600">{activeOrder.paymentMethod}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Product</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{activeOrder.proxyType}</p>
                <p className="mt-2 text-sm text-slate-600">{activeOrder.quantityLabel}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
                <div className="mt-2">
                  <Badge variant={statusVariant(activeOrder.status)} className="capitalize">
                    {activeOrder.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{formatDate(activeOrder.createdAt)}</p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setActiveOrder(null)}>
              Close
            </Button>
            {activeOrder ? (
              <Button className="rounded-2xl" onClick={() => openFulfillment(activeOrder)}>
                Open Fulfillment
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteCandidate)} onOpenChange={(open) => (open ? undefined : setDeleteCandidate(null))}>
        <DialogContent className="rounded-[28px] border-white/80 bg-white/95">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Delete order record</DialogTitle>
            <DialogDescription>
              This removes the selected order from the admin dashboard. Use this only for bad data or cleanup.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-3xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {deleteCandidate ? `You are deleting order ${deleteCandidate.id}. This cannot be undone from the UI.` : null}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDeleteCandidate(null)}>
              Cancel
            </Button>
            <Button variant="destructive" className="rounded-2xl" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
