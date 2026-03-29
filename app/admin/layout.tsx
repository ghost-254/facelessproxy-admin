import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await requireAdmin("/admin");

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
