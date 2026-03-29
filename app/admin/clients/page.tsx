import ClientsConsole from "@/components/admin/ClientsConsole";
import { getAllClients } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const clients = await getAllClients();

  return <ClientsConsole initialClients={clients} />;
}
