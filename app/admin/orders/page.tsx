import OrdersConsole from "@/components/admin/OrdersConsole";
import { getAllOrders } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return <OrdersConsole initialOrders={orders} />;
}
