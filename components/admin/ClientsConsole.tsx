"use client";

import { useMemo, useState } from "react";
import { Mail, Search, Send, UserRoundCheck } from "lucide-react";

import type { AdminClient } from "@/lib/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type ClientsConsoleProps = {
  initialClients: AdminClient[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ClientsConsole({ initialClients }: ClientsConsoleProps) {
  const [clients, setClients] = useState(initialClients);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return clients.filter((client) => !term || client.email.toLowerCase().includes(term));
  }, [clients, searchTerm]);

  const stats = useMemo(() => {
    const now = Date.now();
    const newIn30Days = clients.filter((client) => {
      if (!client.createdAt) {
        return false;
      }

      return now - new Date(client.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000;
    }).length;

    const contacted = clients.filter((client) => Boolean(client.lastMessaged)).length;

    return {
      total: clients.length,
      newIn30Days,
      contacted,
      untouched: clients.length - contacted,
    };
  }, [clients]);

  function toggleClient(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelectedIds((current) =>
      current.length === filteredClients.length ? [] : filteredClients.map((client) => client.id),
    );
  }

  async function handleRecordOutreach() {
    if (!subject.trim() || !message.trim() || selectedIds.length === 0) {
      toast({
        title: "Missing details",
        description: "Add a subject, message, and at least one client before recording outreach.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/clients/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientIds: selectedIds,
          subject,
          message,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to record outreach.");
      }

      const now = new Date().toISOString();
      setClients((current) =>
        current.map((client) =>
          selectedIds.includes(client.id)
            ? {
                ...client,
                lastMessaged: now,
              }
            : client,
        ),
      );
      setSelectedIds([]);
      setSubject("");
      setMessage("");
      setDialogOpen(false);

      toast({
        title: "Outreach recorded",
        description: `Updated ${selectedIds.length} client records with the latest contact timestamp.`,
      });
    } catch (error) {
      toast({
        title: "Outreach failed",
        description: error instanceof Error ? error.message : "Unable to record outreach.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Total</CardDescription>
            <CardTitle className="font-display text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">All client records currently visible in Firebase.</CardContent>
        </Card>
        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>New in 30 days</CardDescription>
            <CardTitle className="font-display text-3xl">{stats.newIn30Days}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">A quick read on recent acquisition momentum.</CardContent>
        </Card>
        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Contacted</CardDescription>
            <CardTitle className="font-display text-3xl">{stats.contacted}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">Clients with a logged outreach timestamp.</CardContent>
        </Card>
        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Untouched</CardDescription>
            <CardTitle className="font-display text-3xl">{stats.untouched}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">Accounts that still have room for a first touch.</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[28px] border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.95),rgba(8,145,178,0.84))] text-white shadow-xl shadow-slate-900/10">
          <CardHeader>
            <CardDescription className="text-white/70">Client engagement</CardDescription>
            <CardTitle className="font-display text-3xl">Review client accounts and keep outreach records up to date.</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-white/70">Selected</p>
              <p className="mt-2 text-3xl font-semibold">{selectedIds.length}</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-white/70">Filtered</p>
              <p className="mt-2 text-3xl font-semibold">{filteredClients.length}</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-white/70">Ready to update</p>
              <p className="mt-2 text-3xl font-semibold">{selectedIds.length > 0 ? "Yes" : "No"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Search and actions</CardDescription>
            <CardTitle className="font-display text-2xl">Keep targeting simple</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by email"
                className="h-12 rounded-2xl border-white/70 bg-white/80 pl-11"
              />
            </div>
            <Button className="h-12 w-full rounded-2xl" disabled={selectedIds.length === 0} onClick={() => setDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Record Outreach for {selectedIds.length || 0} client{selectedIds.length === 1 ? "" : "s"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[28px] border-white/80 bg-white/80">
        <CardHeader>
          <CardDescription>Client list</CardDescription>
          <CardTitle className="font-display text-2xl">Audience view</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredClients.length > 0 && selectedIds.length === filteredClients.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Outreach</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(client.id)} onCheckedChange={() => toggleClient(client.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{client.email}</p>
                      <p className="text-xs text-slate-500">{client.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(client.createdAt)}</TableCell>
                  <TableCell>{formatDate(client.lastMessaged)}</TableCell>
                  <TableCell>
                    {client.lastMessaged ? (
                      <Badge variant="success" className="gap-1">
                        <UserRoundCheck className="h-3.5 w-3.5" />
                        Contacted
                      </Badge>
                    ) : (
                      <Badge variant="warning">Needs touch</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-[28px] border-white/80 bg-white/95 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Record outreach event</DialogTitle>
            <DialogDescription>
              This logs a campaign touch and updates the selected clients&apos; last contacted timestamps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                Selected audience: <span className="font-semibold text-slate-900">{selectedIds.length}</span>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900" htmlFor="outreach-subject">
                Subject
              </label>
              <Input
                id="outreach-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="March retention check-in"
                className="h-12 rounded-2xl border-white/70 bg-white/80"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900" htmlFor="outreach-message">
                Notes
              </label>
              <Textarea
                id="outreach-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={7}
                placeholder="Summarize the campaign or message that went out to this audience."
                className="rounded-2xl border-white/70 bg-white/80"
              />
            </div>
            <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              <Mail className="mb-2 h-4 w-4" />
              This flow records outreach metadata in Firebase. It does not send email by itself.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-2xl" onClick={handleRecordOutreach} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Record Outreach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
