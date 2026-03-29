import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";

import { SESSION_COOKIE_NAME, SESSION_COOKIE_TTL_MS } from "@/lib/auth/constants";
import { getAdminAuth } from "@/lib/firebase-admin";

export type AdminSessionUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

function parseCsvEnv(value?: string | null) {
  return new Set(
    (value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getAllowedEmails() {
  const configured = parseCsvEnv(process.env.ADMIN_ALLOWED_EMAILS);
  if (configured.size > 0) {
    return configured;
  }

  return parseCsvEnv(process.env.MAILER_ADMIN_NOTIFICATION_EMAILS);
}

function getAllowedUids() {
  return parseCsvEnv(process.env.ADMIN_ALLOWED_UIDS);
}

export function createAdminRedirect(nextPath: string, reason = "auth-required") {
  const params = new URLSearchParams({
    next: nextPath.startsWith("/") ? nextPath : "/admin",
    reason,
  });

  return `/login?${params.toString()}`;
}

export function isAuthorizedAdmin(token: DecodedIdToken) {
  if ((token as DecodedIdToken & { admin?: boolean }).admin === true) {
    return true;
  }

  const allowedUids = getAllowedUids();
  if (allowedUids.size > 0 && allowedUids.has(token.uid.toLowerCase())) {
    return true;
  }

  const allowedEmails = getAllowedEmails();
  const email = token.email?.toLowerCase();
  return Boolean(email && allowedEmails.size > 0 && allowedEmails.has(email));
}

export async function createSessionCookie(idToken: string) {
  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_TTL_MS,
  });
}

export async function verifySessionCookieValue(sessionCookie: string) {
  return getAdminAuth().verifySessionCookie(sessionCookie, true);
}

export async function verifyIdTokenValue(idToken: string) {
  return getAdminAuth().verifyIdToken(idToken, true);
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decodedToken = await verifySessionCookieValue(sessionCookie);
    if (!isAuthorizedAdmin(decodedToken)) {
      return null;
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      name: decodedToken.name ?? null,
      picture: decodedToken.picture ?? null,
    } satisfies AdminSessionUser;
  } catch (error) {
    console.error("Admin session verification failed:", error);
    return null;
  }
}

export async function requireAdmin(nextPath = "/admin") {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect(createAdminRedirect(nextPath));
  }

  return admin;
}

export async function ensureAdminApiAccess() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Admin session required." }, { status: 401 }),
    };
  }

  try {
    const decodedToken = await verifySessionCookieValue(sessionCookie);

    if (!isAuthorizedAdmin(decodedToken)) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Admin access denied." }, { status: 403 }),
      };
    }

    return {
      ok: true as const,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email ?? null,
        name: decodedToken.name ?? null,
        picture: decodedToken.picture ?? null,
      } satisfies AdminSessionUser,
    };
  } catch (error) {
    console.error("Admin API auth failed:", error);
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Invalid or expired admin session." }, { status: 401 }),
    };
  }
}

export { SESSION_COOKIE_NAME, SESSION_COOKIE_TTL_MS };
