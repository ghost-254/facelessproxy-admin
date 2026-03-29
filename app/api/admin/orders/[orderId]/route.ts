import { NextResponse } from "next/server";

import { deleteOrderById, getOrderById } from "@/lib/admin/data";
import { ensureAdminApiAccess } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { orderId } = await context.params;
  const order = await getOrderById(orderId);

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { orderId } = await context.params;

  try {
    await deleteOrderById(orderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin order delete failed:", error);
    return NextResponse.json({ error: "Unable to delete this order." }, { status: 500 });
  }
}
