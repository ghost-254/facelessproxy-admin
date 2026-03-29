import type { AdminSessionUser } from "@/lib/auth/server";

export interface AdminOrderSummary {
  id: string;
  status: string;
  paymentStatus: string;
  proxyType: string;
  amount: number;
  paymentMethod: string;
  createdAt: string | null;
  customerEmail: string | null;
  isSpecialProxy: boolean;
  locationLabel: string;
  quantityLabel: string;
  paymentOption: string | null;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  raw: Record<string, unknown>;
}

export interface AdminClient {
  id: string;
  email: string;
  createdAt: string | null;
  lastMessaged: string | null;
}

export interface DashboardMetric {
  label: string;
  value: string;
  delta: string;
  tone: "default" | "success" | "warning";
}

export interface DashboardOverview {
  metrics: DashboardMetric[];
  recentOrders: AdminOrderSummary[];
  pipeline: {
    label: string;
    value: number;
  }[];
  revenueSeries: {
    label: string;
    revenue: number;
  }[];
  admin: AdminSessionUser;
}

export interface AnalyticsOverview {
  revenueByMonth: {
    label: string;
    revenue: number;
  }[];
  ordersByStatus: {
    label: string;
    value: number;
  }[];
  ordersByProduct: {
    label: string;
    value: number;
  }[];
  clientGrowth: {
    label: string;
    value: number;
  }[];
}
