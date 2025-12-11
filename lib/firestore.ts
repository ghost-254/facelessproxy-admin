import { db } from "@/lib/firebaseConfig";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  DocumentSnapshot,
  Timestamp,
} from "firebase/firestore";

export async function getOrdersPage({
  pageSize = 50,
  lastDoc = null,
  filters = {},
}: {
  pageSize?: number;
  lastDoc?: DocumentSnapshot | null;
  filters?: {
    status?: string;
    paymentMethod?: string;
    productType?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}) {
  let q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(pageSize));

  // Apply filters only if set
  if (filters.status && filters.status !== "all") {
    // Handle status/paymentStatus duality
    q = query(q, where("paymentStatus", "==", filters.status));
  }
  if (filters.paymentMethod && filters.paymentMethod !== "all") {
    q = query(q, where("paymentMethod", "==", filters.paymentMethod));
  }
  if (filters.productType && filters.productType !== "all") {
    // Handle nested proxyType
    q = query(q, where("orderDetails.proxyType", "==", filters.productType));
  }
  if (filters.dateFrom) {
    q = query(q, where("createdAt", ">=", Timestamp.fromDate(new Date(filters.dateFrom))));
  }
  if (filters.dateTo) {
    const endDate = new Date(filters.dateTo);
    endDate.setHours(23, 59, 59, 999);
    q = query(q, where("createdAt", "<=", Timestamp.fromDate(endDate)));
  }

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const orders = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    orders,
    lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
  };
}