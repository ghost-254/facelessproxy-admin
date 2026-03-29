import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type { AdminSessionUser } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminClient, AdminOrderDetail, AdminOrderSummary, AnalyticsOverview, DashboardOverview } from "@/lib/admin/types";

type FirestoreRecord = Record<string, unknown>;
const ADMIN_ORDERS_TAG = "admin-orders";
const ADMIN_CLIENTS_TAG = "admin-clients";

function collection(name: string) {
  return getAdminDb().collection(name);
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeValue(entry)]));
  }

  return value ?? null;
}

function toDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (isPlainObject(value) && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  return null;
}

function toIsoString(value: unknown) {
  return toDateValue(value)?.toISOString() ?? null;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function percentage(part: number, total: number) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((part / total) * 100)}%`;
}

function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getAmount(data: FirestoreRecord) {
  const value =
    data.totalAmount ??
    data.finalTotal ??
    data.totalPrice ??
    (isPlainObject(data.orderDetails) ? data.orderDetails.totalPrice : undefined) ??
    0;

  return Number(value) || 0;
}

function getProxyType(data: FirestoreRecord) {
  if (isPlainObject(data.orderDetails) && typeof data.orderDetails.proxyType === "string") {
    return data.orderDetails.proxyType;
  }

  if (typeof data.proxyType === "string" && data.proxyType.trim()) {
    return data.proxyType;
  }

  return "Unclassified";
}

function getPaymentStatus(data: FirestoreRecord) {
  const raw = sanitizeText(data.paymentStatus || data.status).toLowerCase();

  if (!raw) {
    return "pending";
  }

  if (raw.includes("fulfill")) {
    return "fulfilled";
  }

  if (raw === "not-paid") {
    return "unpaid";
  }

  return raw;
}

function getStatus(data: FirestoreRecord) {
  const raw = sanitizeText(data.status).toLowerCase();

  if (!raw) {
    return getPaymentStatus(data);
  }

  if (raw.includes("fulfill")) {
    return "fulfilled";
  }

  return raw;
}

function getLocationLabel(data: FirestoreRecord) {
  if (Array.isArray(data.locations) && data.locations.length > 0) {
    if (data.locations.length === 1 && isPlainObject(data.locations[0])) {
      const location = data.locations[0];
      return [location.city, location.state, location.country].filter((entry) => typeof entry === "string" && entry).join(", ");
    }

    return `${data.locations.length} locations`;
  }

  if (typeof data.location === "string" && data.location.trim()) {
    return data.location;
  }

  if (isPlainObject(data.orderDetails) && typeof data.orderDetails.location === "string") {
    return data.orderDetails.location;
  }

  return "Flexible";
}

function getQuantityLabel(data: FirestoreRecord) {
  const proxyCount = Number(data.proxyCount);
  if (!Number.isNaN(proxyCount) && proxyCount > 0) {
    return `${proxyCount} proxies`;
  }

  const gbAmount = Number(data.gbAmount || (isPlainObject(data.orderDetails) ? data.orderDetails.gbAmount : undefined));
  if (!Number.isNaN(gbAmount) && gbAmount > 0) {
    return `${gbAmount} GB`;
  }

  if (Array.isArray(data.locations) && data.locations.length > 0) {
    return `${data.locations.length} locations`;
  }

  return "Custom";
}

function getCustomerEmail(data: FirestoreRecord) {
  const candidate = data.email || data.userEmail || data.customerEmail;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function sortByDateDesc<T extends { createdAt: string | null }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function normalizeOrderRecord(id: string, rawData: FirestoreRecord): AdminOrderSummary {
  const createdAt = toIsoString(rawData.createdAt || rawData.fulfilledAt || rawData.updatedAt);

  return {
    id,
    status: getStatus(rawData),
    paymentStatus: getPaymentStatus(rawData),
    proxyType: getProxyType(rawData),
    amount: getAmount(rawData),
    paymentMethod: sanitizeText(rawData.paymentMethod) || "Manual",
    createdAt,
    customerEmail: getCustomerEmail(rawData),
    isSpecialProxy: Boolean(
      rawData.isSpecialProxy || (isPlainObject(rawData.orderDetails) ? rawData.orderDetails.isSpecialProxy : false),
    ),
    locationLabel: getLocationLabel(rawData),
    quantityLabel: getQuantityLabel(rawData),
    paymentOption: sanitizeText(rawData.paymentOption || (isPlainObject(rawData.orderDetails) ? rawData.orderDetails.paymentOption : null)) || null,
  };
}

function normalizeOrderDetail(id: string, rawData: FirestoreRecord): AdminOrderDetail {
  const summary = normalizeOrderRecord(id, rawData);

  return {
    ...summary,
    raw: serializeValue(rawData) as Record<string, unknown>,
  };
}

function normalizeClientRecord(id: string, rawData: FirestoreRecord): AdminClient {
  return {
    id,
    email: sanitizeText(rawData.email) || "no-email@unknown.com",
    createdAt: toIsoString(rawData.createdAt),
    lastMessaged: toIsoString(rawData.lastMessaged),
  };
}

const getAllOrdersCached = unstable_cache(
  async () => {
    const snapshot = await collection("orders").get();
    const orders = snapshot.docs.map((doc) => normalizeOrderRecord(doc.id, doc.data() as FirestoreRecord));
    return sortByDateDesc(orders);
  },
  ["admin-orders-all"],
  {
    revalidate: 60,
    tags: [ADMIN_ORDERS_TAG],
  },
);

export async function getAllOrders() {
  return getAllOrdersCached();
}

export async function getFreshOrders() {
  const snapshot = await collection("orders").get();
  const orders = snapshot.docs.map((doc) => normalizeOrderRecord(doc.id, doc.data() as FirestoreRecord));
  return sortByDateDesc(orders);
}

export async function getOrderById(orderId: string) {
  const snapshot = await collection("orders").doc(orderId).get();

  if (!snapshot.exists) {
    return null;
  }

  return normalizeOrderDetail(snapshot.id, snapshot.data() as FirestoreRecord);
}

export async function deleteOrderById(orderId: string) {
  await collection("orders").doc(orderId).delete();
  revalidateTag(ADMIN_ORDERS_TAG, "max");
}

type StandardProxyDetails = {
  ip: string;
  port: string;
  username: string;
  password: string;
  protocol: "http" | "https" | "socks5";
};

type StandardFulfillmentPayload = {
  mode: "standard";
  proxyDetails: Record<string, StandardProxyDetails>;
  locations: Array<Record<string, string>>;
  gbAmount?: number | null;
};

type SpecialFulfillmentPayload = {
  mode: "special";
  proxyList: string[];
};

export async function fulfillOrder(orderId: string, payload: StandardFulfillmentPayload | SpecialFulfillmentPayload) {
  const orderRef = collection("orders").doc(orderId);

  if (payload.mode === "special") {
    const sanitizedProxyList = payload.proxyList
      .map((entry) => entry.trim())
      .filter(Boolean);

    await orderRef.update({
      status: "fulfilled",
      proxyList: sanitizedProxyList,
      fulfilledAt: FieldValue.serverTimestamp(),
    });

    revalidateTag(ADMIN_ORDERS_TAG, "max");
    return;
  }

  const sanitizedProxyDetails = Object.fromEntries(
    Object.entries(payload.proxyDetails || {}).map(([key, value]) => [
      key,
      {
        ip: sanitizeText(value.ip),
        port: sanitizeText(value.port),
        username: sanitizeText(value.username),
        password: sanitizeText(value.password),
        protocol: value.protocol,
      },
    ]),
  );

  await orderRef.update({
    status: "fulfilled",
    proxyDetails: sanitizedProxyDetails,
    locations: payload.locations,
    gbAmount: typeof payload.gbAmount === "number" ? payload.gbAmount : null,
    fulfilledAt: FieldValue.serverTimestamp(),
  });

  revalidateTag(ADMIN_ORDERS_TAG, "max");
}

const getAllClientsCached = unstable_cache(
  async () => {
    const snapshot = await collection("users").get();
    const clients = snapshot.docs.map((doc) => normalizeClientRecord(doc.id, doc.data() as FirestoreRecord));
    return sortByDateDesc(clients);
  },
  ["admin-clients-all"],
  {
    revalidate: 60,
    tags: [ADMIN_CLIENTS_TAG],
  },
);

export async function getAllClients() {
  return getAllClientsCached();
}

export async function recordClientOutreach(clientIds: string[], subject: string, message: string, admin: AdminSessionUser) {
  const uniqueClientIds = [...new Set(clientIds.map((clientId) => clientId.trim()).filter(Boolean))];

  if (uniqueClientIds.length === 0) {
    throw new Error("Select at least one client before recording outreach.");
  }

  const batch = getAdminDb().batch();

  for (const clientId of uniqueClientIds) {
    batch.set(
      collection("users").doc(clientId),
      {
        lastMessaged: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  batch.set(collection("adminMessages").doc(), {
    subject: subject.trim(),
    message: message.trim(),
    audienceSize: uniqueClientIds.length,
    clientIds: uniqueClientIds,
    createdAt: FieldValue.serverTimestamp(),
    sentBy: {
      uid: admin.uid,
      email: admin.email ?? null,
      name: admin.name ?? null,
    },
  });

  await batch.commit();
  revalidateTag(ADMIN_CLIENTS_TAG, "max");
}

function buildRevenueSeries(orders: AdminOrderSummary[]) {
  const now = new Date();
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      key: date.toISOString().slice(0, 10),
      label,
      revenue: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const order of orders) {
    if (!order.createdAt) {
      continue;
    }

    const dayKey = order.createdAt.slice(0, 10);
    const target = bucketMap.get(dayKey);
    if (target && (order.paymentStatus === "paid" || order.status === "fulfilled")) {
      target.revenue += order.amount;
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    revenue: bucket.revenue,
  }));
}

function buildMonthlyCounts<T extends { createdAt: string | null }>(items: T[]) {
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: date.toLocaleDateString("en-US", { month: "short" }),
      value: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const item of items) {
    if (!item.createdAt) {
      continue;
    }

    const date = new Date(item.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.value += 1;
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.value,
  }));
}

export async function getDashboardOverview(admin: AdminSessionUser): Promise<DashboardOverview> {
  const [orders, clients] = await Promise.all([getAllOrders(), getAllClients()]);
  const fulfilledOrders = orders.filter((order) => order.status === "fulfilled");
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid" || order.status === "fulfilled");
  const pendingOrders = orders.filter((order) => order.paymentStatus === "pending" || order.status === "pending");
  const unpaidOrders = orders.filter((order) => order.paymentStatus === "unpaid");
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);

  return {
    admin,
    metrics: [
      {
        label: "Captured Revenue",
        value: currency(totalRevenue),
        delta: `${paidOrders.length} paid orders`,
        tone: "success",
      },
      {
        label: "Fulfillment Queue",
        value: String(pendingOrders.length),
        delta: unpaidOrders.length > 0 ? `${unpaidOrders.length} unpaid need attention` : "No unpaid blockers",
        tone: pendingOrders.length > 0 ? "warning" : "default",
      },
      {
        label: "Client Base",
        value: clients.length.toLocaleString("en-US"),
        delta: `${buildMonthlyCounts(clients).at(-1)?.value ?? 0} joined this month`,
        tone: "default",
      },
      {
        label: "Conversion",
        value: percentage(fulfilledOrders.length, Math.max(orders.length, 1)),
        delta: `${fulfilledOrders.length} fulfilled of ${orders.length} total`,
        tone: "success",
      },
    ],
    recentOrders: orders.slice(0, 8),
    pipeline: [
      { label: "Pending", value: pendingOrders.length },
      { label: "Fulfilled", value: fulfilledOrders.length },
      { label: "Unpaid", value: unpaidOrders.length },
    ],
    revenueSeries: buildRevenueSeries(orders),
  };
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const [orders, clients] = await Promise.all([getAllOrders(), getAllClients()]);

  const statusCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();
  const revenueBuckets = new Map<string, number>();

  for (const order of orders) {
    statusCounts.set(order.status, (statusCounts.get(order.status) || 0) + 1);
    productCounts.set(order.proxyType, (productCounts.get(order.proxyType) || 0) + 1);

    if (order.createdAt) {
      const date = new Date(order.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      revenueBuckets.set(key, (revenueBuckets.get(key) || 0) + order.amount);
    }
  }

  const orderedRevenueByMonth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    return {
      label: date.toLocaleDateString("en-US", { month: "short" }),
      revenue: revenueBuckets.get(key) || 0,
    };
  });

  return {
    revenueByMonth: orderedRevenueByMonth,
    ordersByStatus: Array.from(statusCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value),
    ordersByProduct: Array.from(productCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6),
    clientGrowth: buildMonthlyCounts(clients),
  };
}
