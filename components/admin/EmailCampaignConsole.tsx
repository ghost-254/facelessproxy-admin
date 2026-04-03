"use client";

import { useMemo, useState } from "react";
import { MailCheck, Megaphone, Send, Users, UserRound } from "lucide-react";

import type { AdminClient } from "@/lib/admin/types";
import {
  EMAIL_CAMPAIGN_TEMPLATES,
  getDefaultTemplateVariables,
  renderEmailCampaignTemplate,
  type EmailCampaignRecipientMode,
  type EmailCampaignTemplateId,
  type EmailTemplateVariableKey,
  type EmailTemplateVariables,
} from "@/lib/admin/email-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type EmailCampaignConsoleProps = {
  initialClients: AdminClient[];
};

type SendCampaignResponse = {
  ok?: boolean;
  attemptedCount?: number;
  sentCount?: number;
  failedCount?: number;
  partial?: boolean;
  error?: string;
  failedRecipients?: Array<{ email: string; reason: string }>;
};

function sanitize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function initials(name?: string | null) {
  const source = sanitize(name);
  if (!source) {
    return "CL";
  }

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((entry) => entry.charAt(0).toUpperCase())
    .join("");
}

function toTemplateId(value: string): EmailCampaignTemplateId {
  return value as EmailCampaignTemplateId;
}

export default function EmailCampaignConsole({ initialClients }: EmailCampaignConsoleProps) {
  const [templateId, setTemplateId] = useState<EmailCampaignTemplateId>(EMAIL_CAMPAIGN_TEMPLATES[0].id);
  const [recipientMode, setRecipientMode] = useState<EmailCampaignRecipientMode>(
    EMAIL_CAMPAIGN_TEMPLATES[0].recommendedMode,
  );
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [variables, setVariables] = useState<EmailTemplateVariables>(getDefaultTemplateVariables(EMAIL_CAMPAIGN_TEMPLATES[0].id));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<SendCampaignResponse | null>(null);

  const selectedTemplate = useMemo(
    () => EMAIL_CAMPAIGN_TEMPLATES.find((template) => template.id === templateId) ?? EMAIL_CAMPAIGN_TEMPLATES[0],
    [templateId],
  );

  const knownEmails = useMemo(() => {
    const unique = new Set<string>();
    for (const client of initialClients) {
      const email = sanitize(client.email).toLowerCase();
      if (!email || email === "no-email@unknown.com" || !isValidEmail(email)) {
        continue;
      }

      unique.add(email);
    }
    return [...unique].sort((left, right) => left.localeCompare(right));
  }, [initialClients]);

  const missingRequiredFields = useMemo(() => {
    return selectedTemplate.fields.filter((field) => field.required && !sanitize(variables[field.key]));
  }, [selectedTemplate, variables]);

  const preview = useMemo(() => {
    return renderEmailCampaignTemplate(selectedTemplate.id, {
      recipientName: recipientName || "Jeff",
      recipientEmail: recipientEmail || "client@example.com",
      variables,
      supportEmail: "support@facelessproxy.com",
      whatsappContact: "WhatsApp support",
    });
  }, [selectedTemplate, recipientEmail, recipientName, variables]);

  const canSend =
    !isSubmitting &&
    missingRequiredFields.length === 0 &&
    (recipientMode === "all_clients"
      ? knownEmails.length > 0
      : isValidEmail(recipientEmail.trim().toLowerCase()) &&
        (!selectedTemplate.requiresRecipientName || Boolean(sanitize(recipientName))));

  function handleTemplateChange(nextTemplateId: string) {
    const parsed = toTemplateId(nextTemplateId);
    const nextTemplate =
      EMAIL_CAMPAIGN_TEMPLATES.find((template) => template.id === parsed) ?? EMAIL_CAMPAIGN_TEMPLATES[0];

    setTemplateId(nextTemplate.id);
    setRecipientMode(nextTemplate.recommendedMode);
    setVariables(getDefaultTemplateVariables(nextTemplate.id));
  }

  function updateVariable(key: EmailTemplateVariableKey, value: string) {
    setVariables((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSendCampaign() {
    if (missingRequiredFields.length > 0) {
      toast({
        title: "Missing template details",
        description: `Complete: ${missingRequiredFields.map((field) => field.label).join(", ")}.`,
        variant: "destructive",
      });
      return;
    }

    if (recipientMode === "single" && !isValidEmail(recipientEmail.trim().toLowerCase())) {
      toast({
        title: "Invalid recipient",
        description: "Enter a valid client email before sending.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTemplate.requiresRecipientName && recipientMode === "single" && !sanitize(recipientName)) {
      toast({
        title: "Recipient name required",
        description: "This template needs a client name for personalization.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setLastResult(null);

    try {
      const response = await fetch("/api/admin/emails/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          recipientMode,
          recipientEmail: recipientMode === "single" ? recipientEmail.trim().toLowerCase() : undefined,
          recipientName: recipientMode === "single" ? sanitize(recipientName) : undefined,
          variables,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as SendCampaignResponse;
      setLastResult(payload);

      if (!response.ok) {
        throw new Error(payload.error || "Unable to send this campaign.");
      }

      if (payload.partial) {
        toast({
          title: "Campaign partially sent",
          description: `Sent ${payload.sentCount ?? 0} of ${payload.attemptedCount ?? 0}.`,
        });
      } else {
        toast({
          title: "Campaign delivered",
          description: `Email sent to ${payload.sentCount ?? 0} recipient${payload.sentCount === 1 ? "" : "s"}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Send failed",
        description: error instanceof Error ? error.message : "Unable to send this campaign.",
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
            <CardDescription>Template library</CardDescription>
            <CardTitle className="font-display text-3xl">{EMAIL_CAMPAIGN_TEMPLATES.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">Creative campaigns available to trigger instantly.</CardContent>
        </Card>
        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Reachable clients</CardDescription>
            <CardTitle className="font-display text-3xl">{knownEmails.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">Unique client emails currently available for broadcast.</CardContent>
        </Card>
        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Audience mode</CardDescription>
            <CardTitle className="font-display text-3xl capitalize">
              {recipientMode === "all_clients" ? "All" : "Single"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            {recipientMode === "all_clients"
              ? "Broadcasting to every valid client email."
              : "Sending one personalized message."}
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Status</CardDescription>
            <CardTitle className="font-display text-3xl">
              {lastResult?.sentCount ? `${lastResult.sentCount}` : "Ready"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            {lastResult?.partial
              ? `Partial send: ${lastResult.failedCount ?? 0} failed.`
              : "Choose a template, preview it, and trigger with one click."}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[28px] border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.95),rgba(14,165,233,0.84))] text-white shadow-xl shadow-slate-900/10">
          <CardHeader>
            <CardDescription className="text-white/70">Campaign control center</CardDescription>
            <CardTitle className="font-display text-3xl">
              Build professional campaigns and send them to all clients or one specific inbox.
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/20 bg-white/10 p-4">
              <p className="text-sm text-white/75">Selected template</p>
              <p className="mt-2 text-lg font-semibold">{selectedTemplate.label}</p>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/10 p-4">
              <p className="text-sm text-white/75">Audience</p>
              <p className="mt-2 text-lg font-semibold">
                {recipientMode === "all_clients" ? `${knownEmails.length} clients` : "Single client"}
              </p>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/10 p-4">
              <p className="text-sm text-white/75">Send readiness</p>
              <p className="mt-2 text-lg font-semibold">{canSend ? "Ready" : "Review inputs"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Quick actions</CardDescription>
            <CardTitle className="font-display text-2xl">Audience targeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={recipientMode === "all_clients" ? "default" : "outline"}
                className="rounded-2xl"
                onClick={() => setRecipientMode("all_clients")}
              >
                <Users className="mr-2 h-4 w-4" />
                Send to all clients
              </Button>
              <Button
                type="button"
                variant={recipientMode === "single" ? "default" : "outline"}
                className="rounded-2xl"
                onClick={() => setRecipientMode("single")}
              >
                <UserRound className="mr-2 h-4 w-4" />
                Send to one client
              </Button>
            </div>

            {recipientMode === "single" ? (
              <div className="space-y-3">
                <Input
                  list="email-campaign-clients"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  placeholder="client@email.com"
                  className="h-12 rounded-2xl border-white/70 bg-white/80"
                />
                <datalist id="email-campaign-clients">
                  {knownEmails.map((email) => (
                    <option key={email} value={email} />
                  ))}
                </datalist>
                <Input
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="Client first name"
                  className="h-12 rounded-2xl border-white/70 bg-white/80"
                />
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                This campaign will send to all valid client emails currently stored in your Firebase users collection.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[28px] border-white/80 bg-white/80">
        <CardHeader>
          <CardDescription>Template setup</CardDescription>
          <CardTitle className="font-display text-2xl">Select campaign and customize variables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Template</label>
            <Select value={templateId} onValueChange={handleTemplateChange}>
              <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/80">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_CAMPAIGN_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">{selectedTemplate.description}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {selectedTemplate.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <Input
                  value={variables[field.key] ?? ""}
                  onChange={(event) => updateVariable(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="h-12 rounded-2xl border-white/70 bg-white/80"
                />
                <p className="text-xs text-slate-500">{field.description}</p>
              </div>
            ))}
          </div>

          {selectedTemplate.requiresRecipientName ? (
            <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              This template performs best with a real first name so the message feels private and personal.
            </div>
          ) : null}

          {missingRequiredFields.length > 0 ? (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              Missing required fields: {missingRequiredFields.map((field) => field.label).join(", ")}.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Email preview</CardDescription>
            <CardTitle className="font-display text-2xl">Subject + body preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Subject</p>
              <p className="mt-2 font-medium text-slate-900">{preview.subject}</p>
            </div>
            <Textarea value={preview.text} readOnly rows={11} className="rounded-2xl border-white/70 bg-slate-50 text-sm leading-6" />
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader>
            <CardDescription>Send campaign</CardDescription>
            <CardTitle className="font-display text-2xl">Trigger delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                <strong className="text-slate-900">Template:</strong> {selectedTemplate.label}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                <strong className="text-slate-900">Mode:</strong>{" "}
                {recipientMode === "all_clients" ? `All clients (${knownEmails.length})` : "Single client"}
              </p>
              {recipientMode === "single" && recipientEmail ? (
                <p className="mt-2 text-sm text-slate-600">
                  <strong className="text-slate-900">Recipient:</strong> {recipientEmail}
                </p>
              ) : null}
            </div>

            {lastResult ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-900">Last send result</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <MailCheck className="h-3.5 w-3.5" />
                    Attempted: {lastResult.attemptedCount ?? 0}
                  </Badge>
                  <Badge variant="success">Sent: {lastResult.sentCount ?? 0}</Badge>
                  <Badge variant={lastResult.failedCount ? "destructive" : "secondary"}>
                    Failed: {lastResult.failedCount ?? 0}
                  </Badge>
                </div>
                {lastResult.failedRecipients?.length ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Sample failed recipients:{" "}
                    {lastResult.failedRecipients
                      .slice(0, 3)
                      .map((entry) => entry.email)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <Button className="h-12 w-full rounded-2xl" disabled={!canSend} onClick={handleSendCampaign}>
              {isSubmitting ? (
                "Sending..."
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send campaign now
                </>
              )}
            </Button>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
              <p className="inline-flex items-center gap-2 font-medium text-slate-800">
                <Megaphone className="h-4 w-4" />
                Campaign safety
              </p>
              <p className="mt-2">
                Each send is logged in admin records, and matched clients get their outreach timestamp updated automatically.
              </p>
              {recipientMode === "single" ? (
                <p className="mt-2 inline-flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {initials(recipientName)}
                  </span>
                  Personalization active for this single-recipient send.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
