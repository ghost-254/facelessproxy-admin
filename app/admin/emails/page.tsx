import EmailCampaignConsole from "@/components/admin/EmailCampaignConsole";
import { getAllClients } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  const clients = await getAllClients();

  return <EmailCampaignConsole initialClients={clients} />;
}
