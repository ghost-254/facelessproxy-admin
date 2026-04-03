import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { getAllClients } from "@/lib/admin/data";
import {
  getEmailCampaignTemplateById,
  renderEmailCampaignTemplate,
  type EmailCampaignRecipientMode,
  type EmailTemplateVariables,
} from "@/lib/admin/email-templates";
import { ensureAdminApiAccess } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSupportEmailContact, getSupportWhatsappContact, sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendCampaignPayload = {
  templateId?: string;
  recipientMode?: EmailCampaignRecipientMode;
  recipientEmail?: string;
  recipientName?: string;
  variables?: EmailTemplateVariables;
};

type Recipient = {
  email: string;
  clientId: string | null;
  name: string | null;
};

function sanitize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function dedupeRecipients(recipients: Recipient[]) {
  const unique = new Map<string, Recipient>();

  for (const recipient of recipients) {
    const key = normalizeEmail(recipient.email);
    if (!key || !isValidEmail(key) || key === "no-email@unknown.com") {
      continue;
    }

    const current = unique.get(key);
    if (!current) {
      unique.set(key, { ...recipient, email: key });
      continue;
    }

    if (!current.clientId && recipient.clientId) {
      unique.set(key, { ...recipient, email: key });
    }
  }

  return [...unique.values()];
}

function toBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown send error";
}

export async function POST(request: Request) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const payload = (await request.json()) as SendCampaignPayload;
    const template = getEmailCampaignTemplateById(sanitize(payload.templateId));
    if (!template) {
      return NextResponse.json({ error: "Select a valid email template before sending." }, { status: 400 });
    }

    const requestedMode = payload.recipientMode;
    const recipientMode: EmailCampaignRecipientMode =
      requestedMode === "all_clients" || requestedMode === "single"
        ? requestedMode
        : template.recommendedMode;

    let recipients: Recipient[] = [];
    if (recipientMode === "all_clients") {
      const clients = await getAllClients();
      recipients = clients.map((client) => ({
        email: normalizeEmail(client.email),
        clientId: client.id,
        name: null,
      }));
    } else {
      const recipientEmail = sanitize(payload.recipientEmail).toLowerCase();
      if (!recipientEmail || !isValidEmail(recipientEmail)) {
        return NextResponse.json(
          { error: "Enter a valid client email before sending." },
          { status: 400 },
        );
      }

      recipients = [
        {
          email: recipientEmail,
          clientId: null,
          name: sanitize(payload.recipientName) || null,
        },
      ];
    }

    recipients = dedupeRecipients(recipients);
    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No deliverable recipients were found for this campaign." },
        { status: 400 },
      );
    }

    if (template.requiresRecipientName && recipientMode === "single" && !sanitize(payload.recipientName)) {
      return NextResponse.json(
        { error: "This template requires a recipient name before sending." },
        { status: 400 },
      );
    }

    if (recipients.length > 1200) {
      return NextResponse.json(
        { error: "Audience is too large for one request. Please send in smaller batches." },
        { status: 400 },
      );
    }

    const supportEmail = getSupportEmailContact();
    const whatsappContact = getSupportWhatsappContact();

    const sentRecipients: Recipient[] = [];
    const failedRecipients: Array<{ email: string; reason: string }> = [];
    let firstSubject = "";
    let firstTextMessage = "";

    for (const batch of toBatches(recipients, 6)) {
      const outcomes = await Promise.all(
        batch.map(async (recipient) => {
          try {
            const rendered = renderEmailCampaignTemplate(template.id, {
              recipientName: recipient.name || sanitize(payload.recipientName) || null,
              recipientEmail: recipient.email,
              variables: payload.variables,
              supportEmail,
              whatsappContact,
            });

            await sendEmail({
              to: recipient.email,
              subject: rendered.subject,
              text: rendered.text,
              html: rendered.html,
            });

            return {
              ok: true as const,
              recipient,
              subject: rendered.subject,
              text: rendered.text,
            };
          } catch (error) {
            return {
              ok: false as const,
              recipient,
              reason: toErrorMessage(error),
            };
          }
        }),
      );

      for (const outcome of outcomes) {
        if (outcome.ok) {
          sentRecipients.push(outcome.recipient);
          if (!firstSubject) {
            firstSubject = outcome.subject;
            firstTextMessage = outcome.text;
          }
        } else {
          failedRecipients.push({
            email: outcome.recipient.email,
            reason: outcome.reason,
          });
        }
      }
    }

    if (sentRecipients.length === 0) {
      return NextResponse.json(
        {
          error: "Unable to send this campaign. Please check SMTP configuration and try again.",
          failedRecipients: failedRecipients.slice(0, 10),
        },
        { status: 500 },
      );
    }

    const sentClientIds = [...new Set(sentRecipients.map((recipient) => recipient.clientId).filter(Boolean))] as string[];
    const db = getAdminDb();
    const writeBatch = db.batch();

    for (const clientId of sentClientIds) {
      writeBatch.set(
        db.collection("users").doc(clientId),
        {
          lastMessaged: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const campaignLog = {
      channel: "email",
      templateId: template.id,
      templateLabel: template.label,
      recipientMode,
      attemptedCount: recipients.length,
      sentCount: sentRecipients.length,
      failedCount: failedRecipients.length,
      recipientEmailsPreview: sentRecipients.slice(0, 120).map((recipient) => recipient.email),
      failedRecipients: failedRecipients.slice(0, 40),
      subject: firstSubject || template.label,
      message: firstTextMessage || "Email campaign sent.",
      variables: payload.variables || {},
      clientIds: sentClientIds,
      createdAt: FieldValue.serverTimestamp(),
      sentBy: {
        uid: authResult.user.uid,
        email: authResult.user.email ?? null,
        name: authResult.user.name ?? null,
      },
    };

    writeBatch.set(db.collection("adminMessages").doc(), campaignLog);
    writeBatch.set(db.collection("adminEmailCampaigns").doc(), campaignLog);
    await writeBatch.commit();

    return NextResponse.json({
      ok: true,
      template: template.label,
      recipientMode,
      attemptedCount: recipients.length,
      sentCount: sentRecipients.length,
      failedCount: failedRecipients.length,
      failedRecipients: failedRecipients.slice(0, 10),
      partial: failedRecipients.length > 0,
    });
  } catch (error) {
    console.error("Admin email campaign send failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to send email campaign right now.",
      },
      { status: 500 },
    );
  }
}
