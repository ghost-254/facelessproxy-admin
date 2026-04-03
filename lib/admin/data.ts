import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { renderOrderFulfillmentEmail } from "@/lib/admin/email-templates";
import type { AdminSessionUser } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getClientDashboardUrl, getSupportEmailContact, sendEmail } from "@/lib/mailer";
import type { AdminClient, AdminOrderDetail, AdminOrderSummary, AnalyticsOverview, DashboardOverview } from "@/lib/admin/types";

type FirestoreRecord = Record<string, unknown>;
const ADMIN_ORDERS_TAG = "admin-orders";
const ADMIN_CLIENTS_TAG = "admin-clients";
const UNKNOWN_CLIENT_EMAIL = "no-email@unknown.com";
const EMPTY_EMAIL_LOOKUP = new Map<string, string>();
const RUNTIME_ORDERS_CACHE_KEY = "runtime:admin-orders:all";
const RUNTIME_CLIENTS_CACHE_KEY = "runtime:admin-clients:all";
const parsedRuntimeCacheTtlSeconds = Number(process.env.ADMIN_RUNTIME_CACHE_TTL_SECONDS || 900);
const RUNTIME_CACHE_TTL_SECONDS = Number.isFinite(parsedRuntimeCacheTtlSeconds)
  ? Math.max(parsedRuntimeCacheTtlSeconds, 60)
  : 900;
const RUNTIME_CACHE_TTL_MS = RUNTIME_CACHE_TTL_SECONDS * 1000;
const USER_ID_FIELDS = [
  "uid",
  "userId",
  "userID",
  "userUid",
  "userUID",
  "user_id",
  "authUid",
  "clientId",
  "clientID",
  "client_id",
  "customerId",
  "customerID",
  "customer_id",
  "ownerId",
  "owner_id",
  "accountId",
  "account_id",
  "userDocId",
  "userDocID",
  "documentId",
];
const USER_REFERENCE_FIELDS = ["user", "client", "customer", "userRef", "clientRef", "customerRef", "account"];

type RuntimeCacheEntry<T> = {
  value: T;
  fetchedAt: number;
  expiresAt: number;
};

const runtimeCache = new Map<string, RuntimeCacheEntry<unknown>>();
const runtimeInflight = new Map<string, Promise<unknown>>();

function getRuntimeCachedValue<T>(cacheKey: string) {
  const entry = runtimeCache.get(cacheKey) as RuntimeCacheEntry<T> | undefined;
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.value;
}

function getRuntimeStaleValue<T>(cacheKey: string) {
  const entry = runtimeCache.get(cacheKey) as RuntimeCacheEntry<T> | undefined;
  return entry?.value ?? null;
}

function setRuntimeCachedValue<T>(cacheKey: string, value: T, ttlMs = RUNTIME_CACHE_TTL_MS) {
  const now = Date.now();
  runtimeCache.set(cacheKey, {
    value,
    fetchedAt: now,
    expiresAt: now + ttlMs,
  });
}

function clearRuntimeCache(cacheKey: string) {
  runtimeCache.delete(cacheKey);
  runtimeInflight.delete(cacheKey);
}

async function loadWithRuntimeCache<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  options: { forceRefresh?: boolean } = {},
) {
  if (!options.forceRefresh) {
    const cachedValue = getRuntimeCachedValue<T>(cacheKey);
    if (cachedValue) {
      return cachedValue;
    }
  }

  const existingInflight = runtimeInflight.get(cacheKey) as Promise<T> | undefined;
  if (existingInflight) {
    return existingInflight;
  }

  const pendingLoad = (async () => {
    try {
      const loadedValue = await loader();
      setRuntimeCachedValue(cacheKey, loadedValue);
      return loadedValue;
    } catch (error) {
      const staleValue = getRuntimeStaleValue<T>(cacheKey);
      if (staleValue) {
        console.error(`Falling back to stale runtime cache for ${cacheKey}:`, error);
        return staleValue;
      }

      throw error;
    } finally {
      runtimeInflight.delete(cacheKey);
    }
  })();

  runtimeInflight.set(cacheKey, pendingLoad as Promise<unknown>);
  return pendingLoad;
}

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

function getPathTail(value: string) {
  const segments = value.split("/").filter(Boolean);
  return segments.length > 1 ? (segments.at(-1) ?? null) : null;
}

function extractUserId(value: unknown) {
  const direct = sanitizeText(value);
  if (direct) {
    return getPathTail(direct) ?? direct;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  const objectCandidates = [
    value.id,
    value.uid,
    value.userId,
    value.userID,
    value.userUid,
    value.userUID,
    value.user_id,
    value.authUid,
    value.clientId,
    value.clientID,
    value.client_id,
    value.customerId,
    value.customerID,
    value.customer_id,
    value.ownerId,
    value.owner_id,
    value.accountId,
    value.account_id,
    value.path,
    value.docId,
    value.userDocId,
    value.userDocID,
    value.documentId,
  ];

  for (const candidate of objectCandidates) {
    const text = sanitizeText(candidate);
    if (text) {
      return getPathTail(text) ?? text;
    }
  }

  return null;
}

function getKnownEmail(data: FirestoreRecord) {
  const orderDetails = isPlainObject(data.orderDetails) ? data.orderDetails : null;
  const customer = isPlainObject(data.customer) ? data.customer : null;
  const user = isPlainObject(data.user) ? data.user : null;
  const profile = isPlainObject(data.profile) ? data.profile : null;
  const account = isPlainObject(data.account) ? data.account : null;

  const candidates = [
    data.email,
    data.userEmail,
    data.customerEmail,
    orderDetails?.email,
    orderDetails?.userEmail,
    orderDetails?.customerEmail,
    customer?.email,
    user?.email,
    profile?.email,
    account?.email,
  ];

  for (const candidate of candidates) {
    const email = sanitizeText(candidate);
    if (email) {
      return email;
    }
  }

  return null;
}

function getKnownName(data: FirestoreRecord) {
  const orderDetails = isPlainObject(data.orderDetails) ? data.orderDetails : null;
  const customer = isPlainObject(data.customer) ? data.customer : null;
  const user = isPlainObject(data.user) ? data.user : null;
  const profile = isPlainObject(data.profile) ? data.profile : null;
  const account = isPlainObject(data.account) ? data.account : null;

  const candidates = [
    data.name,
    data.fullName,
    data.customerName,
    data.userName,
    data.username,
    orderDetails?.name,
    orderDetails?.fullName,
    orderDetails?.customerName,
    user?.name,
    user?.fullName,
    customer?.name,
    customer?.fullName,
    profile?.name,
    account?.name,
  ];

  for (const candidate of candidates) {
    const name = sanitizeText(candidate);
    if (name) {
      return name;
    }
  }

  return null;
}

function collectUserIdCandidates(data: FirestoreRecord) {
  const orderDetails = isPlainObject(data.orderDetails) ? data.orderDetails : null;
  const candidates = new Set<string>();

  for (const key of USER_ID_FIELDS) {
    const topLevelCandidate = extractUserId(data[key]);
    if (topLevelCandidate) {
      candidates.add(topLevelCandidate);
    }

    if (orderDetails) {
      const nestedCandidate = extractUserId(orderDetails[key]);
      if (nestedCandidate) {
        candidates.add(nestedCandidate);
      }
    }
  }

  for (const key of USER_REFERENCE_FIELDS) {
    const topLevelReferenceCandidate = extractUserId(data[key]);
    if (topLevelReferenceCandidate) {
      candidates.add(topLevelReferenceCandidate);
    }

    if (orderDetails) {
      const nestedReferenceCandidate = extractUserId(orderDetails[key]);
      if (nestedReferenceCandidate) {
        candidates.add(nestedReferenceCandidate);
      }
    }
  }

  return [...candidates];
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function buildClientEmailLookupFromUserIds(userIds: string[]) {
  const normalizedUserIds = [...new Set(userIds.map((userId) => sanitizeText(userId)).filter(Boolean))];
  if (normalizedUserIds.length === 0) {
    return EMPTY_EMAIL_LOOKUP;
  }

  const db = getAdminDb();
  const lookup = new Map<string, string>();
  const userCollection = collection("users");

  for (const userIdChunk of chunkArray(normalizedUserIds, 250)) {
    const references = userIdChunk.map((userId) => userCollection.doc(userId));
    const snapshots = await db.getAll(...references);

    for (const snapshot of snapshots) {
      if (!snapshot.exists) {
        continue;
      }

      const email = getKnownEmail(snapshot.data() as FirestoreRecord);
      if (!email) {
        continue;
      }

      lookup.set(snapshot.id, email);
      lookup.set(snapshot.id.toLowerCase(), email);
    }
  }

  return lookup;
}

async function resolveCustomerEmailForOrder(rawData: FirestoreRecord) {
  const knownEmail = getKnownEmail(rawData);
  if (knownEmail) {
    return knownEmail;
  }

  const userIds = collectUserIdCandidates(rawData);
  if (userIds.length === 0) {
    return null;
  }

  const clientEmailLookup = await buildClientEmailLookupFromUserIds(userIds);
  for (const userId of userIds) {
    const email = lookupClientEmail(clientEmailLookup, userId);
    if (email) {
      return email;
    }
  }

  return null;
}

async function buildClientEmailLookupFromOrders(orderRecords: FirestoreRecord[]) {
  const userIds = new Set<string>();

  for (const orderRecord of orderRecords) {
    for (const userId of collectUserIdCandidates(orderRecord)) {
      const normalizedUserId = sanitizeText(userId);
      if (normalizedUserId) {
        userIds.add(normalizedUserId);
      }
    }
  }

  return buildClientEmailLookupFromUserIds([...userIds]);
}

function lookupClientEmail(clientEmailLookup: Map<string, string>, userId: string) {
  const normalizedUserId = sanitizeText(userId);
  if (!normalizedUserId) {
    return null;
  }

  return clientEmailLookup.get(normalizedUserId) || clientEmailLookup.get(normalizedUserId.toLowerCase()) || null;
}

function toOrderFulfillmentProxyLine(hostname: string, port: string, login: string, password: string) {
  return `${sanitizeText(hostname)}:${sanitizeText(port)}:${sanitizeText(login)}:${sanitizeText(password)}`;
}

function normalizeProxyLine(value: string) {
  const trimmed = sanitizeText(value);
  if (!trimmed) {
    return "";
  }

  const baseCandidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const parsed = new URL(baseCandidate);
    const hostname = sanitizeText(parsed.hostname);
    const port = sanitizeText(parsed.port);
    const login = decodeURIComponent(parsed.username || "");
    const password = decodeURIComponent(parsed.password || "");
    if (hostname && port && login) {
      return toOrderFulfillmentProxyLine(hostname, port, login, password);
    }
  } catch {
    // no-op, fallback below
  }

  const colonParts = trimmed.split(":");
  if (colonParts.length >= 4) {
    const hostname = sanitizeText(colonParts[0]);
    const port = sanitizeText(colonParts[1]);
    const login = sanitizeText(colonParts[2]);
    const password = sanitizeText(colonParts.slice(3).join(":"));
    if (hostname && port && login) {
      return toOrderFulfillmentProxyLine(hostname, port, login, password);
    }
  }

  return trimmed;
}

function locationSortWeight(key: string) {
  const match = key.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
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

function getCustomerEmail(data: FirestoreRecord, clientEmailLookup: Map<string, string>) {
  const knownEmail = getKnownEmail(data);
  if (knownEmail) {
    return knownEmail;
  }

  const userIds = collectUserIdCandidates(data);
  for (const userId of userIds) {
    const email = lookupClientEmail(clientEmailLookup, userId);
    if (email) {
      return email;
    }
  }

  return null;
}

function sortByDateDesc<T extends { createdAt: string | null }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function normalizeOrderRecord(id: string, rawData: FirestoreRecord, clientEmailLookup: Map<string, string> = EMPTY_EMAIL_LOOKUP): AdminOrderSummary {
  const createdAt = toIsoString(rawData.createdAt || rawData.fulfilledAt || rawData.updatedAt);

  return {
    id,
    status: getStatus(rawData),
    paymentStatus: getPaymentStatus(rawData),
    proxyType: getProxyType(rawData),
    amount: getAmount(rawData),
    paymentMethod: sanitizeText(rawData.paymentMethod) || "Manual",
    createdAt,
    customerEmail: getCustomerEmail(rawData, clientEmailLookup),
    isSpecialProxy: Boolean(
      rawData.isSpecialProxy || (isPlainObject(rawData.orderDetails) ? rawData.orderDetails.isSpecialProxy : false),
    ),
    locationLabel: getLocationLabel(rawData),
    quantityLabel: getQuantityLabel(rawData),
    paymentOption: sanitizeText(rawData.paymentOption || (isPlainObject(rawData.orderDetails) ? rawData.orderDetails.paymentOption : null)) || null,
  };
}

function normalizeOrderDetail(id: string, rawData: FirestoreRecord, clientEmailLookup: Map<string, string> = EMPTY_EMAIL_LOOKUP): AdminOrderDetail {
  const summary = normalizeOrderRecord(id, rawData, clientEmailLookup);

  return {
    ...summary,
    raw: serializeValue(rawData) as Record<string, unknown>,
  };
}

function normalizeClientRecord(id: string, rawData: FirestoreRecord): AdminClient {
  return {
    id,
    email: getKnownEmail(rawData) || UNKNOWN_CLIENT_EMAIL,
    createdAt: toIsoString(rawData.createdAt),
    lastMessaged: toIsoString(rawData.lastMessaged),
  };
}

async function fetchOrdersFromFirestore() {
  const snapshot = await collection("orders").get();
  const orderRecords = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as FirestoreRecord,
  }));
  const clientEmailLookup = await buildClientEmailLookupFromOrders(orderRecords.map((entry) => entry.data));
  const orders = orderRecords.map((record) => normalizeOrderRecord(record.id, record.data, clientEmailLookup));
  return sortByDateDesc(orders);
}

const getAllOrdersCached = unstable_cache(
  async () => loadWithRuntimeCache(RUNTIME_ORDERS_CACHE_KEY, fetchOrdersFromFirestore),
  ["admin-orders-all"],
  {
    revalidate: RUNTIME_CACHE_TTL_SECONDS,
    tags: [ADMIN_ORDERS_TAG],
  },
);

export async function getAllOrders() {
  return getAllOrdersCached();
}

export async function getFreshOrders() {
  return loadWithRuntimeCache(RUNTIME_ORDERS_CACHE_KEY, fetchOrdersFromFirestore, { forceRefresh: true });
}

export async function getOrderById(orderId: string) {
  const snapshot = await collection("orders").doc(orderId).get();

  if (!snapshot.exists) {
    return null;
  }

  const rawRecord = snapshot.data() as FirestoreRecord;
  const clientEmailLookup = await buildClientEmailLookupFromUserIds(collectUserIdCandidates(rawRecord));
  return normalizeOrderDetail(snapshot.id, rawRecord, clientEmailLookup);
}

export async function deleteOrderById(orderId: string) {
  await collection("orders").doc(orderId).delete();
  clearRuntimeCache(RUNTIME_ORDERS_CACHE_KEY);
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
  const existingSnapshot = await orderRef.get();

  if (!existingSnapshot.exists) {
    throw new Error("Order not found.");
  }

  const existingData = existingSnapshot.data() as FirestoreRecord;
  const wasFulfilledAlready = getStatus(existingData) === "fulfilled" || Boolean(toDateValue(existingData.fulfilledAt));
  let fulfillmentProxyLines: string[] = [];

  if (payload.mode === "special") {
    const sanitizedProxyList = payload.proxyList
      .map((entry) => entry.trim())
      .filter(Boolean);
    fulfillmentProxyLines = sanitizedProxyList.map((entry) => normalizeProxyLine(entry)).filter(Boolean);

    await orderRef.update({
      status: "fulfilled",
      proxyList: sanitizedProxyList,
      fulfilledAt: FieldValue.serverTimestamp(),
    });
  } else {
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
    const orderedKeys = Object.keys(sanitizedProxyDetails).sort((left, right) => locationSortWeight(left) - locationSortWeight(right));
    fulfillmentProxyLines = orderedKeys
      .map((key) => {
        const details = sanitizedProxyDetails[key];
        if (!details.ip || !details.port || !details.username) {
          return "";
        }

        return toOrderFulfillmentProxyLine(details.ip, details.port, details.username, details.password);
      })
      .filter(Boolean);

    await orderRef.update({
      status: "fulfilled",
      proxyDetails: sanitizedProxyDetails,
      locations: payload.locations,
      gbAmount: typeof payload.gbAmount === "number" ? payload.gbAmount : null,
      fulfilledAt: FieldValue.serverTimestamp(),
    });
  }

  clearRuntimeCache(RUNTIME_ORDERS_CACHE_KEY);
  revalidateTag(ADMIN_ORDERS_TAG, "max");

  if (!wasFulfilledAlready) {
    try {
      const recipientEmail = await resolveCustomerEmailForOrder(existingData);
      if (!recipientEmail) {
        console.error(`Fulfillment email skipped for ${orderId}: customer email is missing.`);
        return;
      }

      const renderedEmail = renderOrderFulfillmentEmail({
        recipientName: getKnownName(existingData),
        recipientEmail,
        orderId,
        proxyLines: fulfillmentProxyLines,
        supportEmail: getSupportEmailContact(),
        dashboardUrl: getClientDashboardUrl(),
      });

      await sendEmail({
        to: recipientEmail,
        subject: renderedEmail.subject,
        text: renderedEmail.text,
        html: renderedEmail.html,
      });
    } catch (error) {
      console.error(`Fulfillment email send failed for ${orderId}:`, error);
    }
  }
}

async function fetchClientsFromFirestore() {
  const snapshot = await collection("users").get();
  const clients = snapshot.docs.map((doc) => normalizeClientRecord(doc.id, doc.data() as FirestoreRecord));
  return sortByDateDesc(clients);
}

const getAllClientsCached = unstable_cache(
  async () => loadWithRuntimeCache(RUNTIME_CLIENTS_CACHE_KEY, fetchClientsFromFirestore),
  ["admin-clients-all"],
  {
    revalidate: RUNTIME_CACHE_TTL_SECONDS,
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
  clearRuntimeCache(RUNTIME_CLIENTS_CACHE_KEY);
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
