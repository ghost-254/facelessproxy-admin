import { NextResponse } from "next/server";

import { recordClientOutreach } from "@/lib/admin/data";
import { ensureAdminApiAccess } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const payload = (await request.json()) as {
      clientIds?: string[];
      subject?: string;
      message?: string;
    };

    if (!Array.isArray(payload.clientIds) || !payload.subject?.trim() || !payload.message?.trim()) {
      return NextResponse.json(
        { error: "clientIds, subject, and message are required to record outreach." },
        { status: 400 },
      );
    }

    await recordClientOutreach(payload.clientIds, payload.subject, payload.message, authResult.user);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin outreach logging failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to record outreach.",
      },
      { status: 500 },
    );
  }
}
