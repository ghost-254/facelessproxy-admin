import { NextResponse } from "next/server";

import { fulfillOrder } from "@/lib/admin/data";
import { ensureAdminApiAccess } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { orderId } = await context.params;

  try {
    const payload = (await request.json()) as
      | {
          mode: "standard";
          proxyDetails: Record<
            string,
            {
              ip: string;
              port: string;
              username: string;
              password: string;
              protocol: "http" | "https" | "socks5";
            }
          >;
          locations: Array<Record<string, string>>;
          gbAmount?: number | null;
        }
      | {
          mode: "special";
          proxyList: string[];
        };

    await fulfillOrder(orderId, payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin fulfillment update failed:", error);
    return NextResponse.json({ error: "Unable to save fulfillment data." }, { status: 500 });
  }
}
