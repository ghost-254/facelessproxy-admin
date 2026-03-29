import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createSessionCookie,
  isAuthorizedAdmin,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_TTL_MS,
  verifyIdTokenValue,
} from "@/lib/auth/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      idToken?: string;
    };

    if (!payload.idToken || typeof payload.idToken !== "string") {
      return NextResponse.json({ error: "A valid Firebase ID token is required." }, { status: 400 });
    }

    const decodedToken = await verifyIdTokenValue(payload.idToken);

    if (!isAuthorizedAdmin(decodedToken)) {
      return NextResponse.json(
        {
          error: "This account is signed in, but it does not have admin access.",
        },
        { status: 403 },
      );
    }

    const sessionCookie = await createSessionCookie(payload.idToken);
    const cookieStore = await cookies();

    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_COOKIE_TTL_MS / 1000,
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin session creation failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create an admin session.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionCookie) {
      try {
        const adminAuth = getAdminAuth();
        const decodedSession = await adminAuth.verifySessionCookie(sessionCookie, true);
        await adminAuth.revokeRefreshTokens(decodedSession.sub);
      } catch (error) {
        console.error("Admin session revoke skipped:", error);
      }
    }

    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0),
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin session clear failed:", error);
    return NextResponse.json({ error: "Unable to clear the admin session." }, { status: 500 });
  }
}
