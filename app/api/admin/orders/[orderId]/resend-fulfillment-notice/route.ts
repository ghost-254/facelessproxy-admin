import { NextResponse } from "next/server";

import { resendOrderFulfillmentNotice } from "@/lib/admin/data";
import { ensureAdminApiAccess } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { orderId } = await context.params;

  try {
    const result = await resendOrderFulfillmentNotice(orderId);
    return NextResponse.json({
      ok: true,
      recipientEmail: result.recipientEmail,
    });
  } catch (error) {
    console.error("Admin resend fulfillment notice failed:", error);
    const message = error instanceof Error ? error.message : "Unable to resend fulfillment notice.";
    const status = message.toLowerCase().includes("not found")
      ? 404
      : message.toLowerCase().includes("not fulfilled")
        ? 400
        : message.toLowerCase().includes("missing")
          ? 400
          : 500;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
