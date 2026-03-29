import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/server";

export default async function Home() {
  const admin = await getCurrentAdmin();
  redirect(admin ? "/admin" : "/login");
}
