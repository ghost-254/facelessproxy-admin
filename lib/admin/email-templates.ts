export type EmailCampaignTemplateId =
  | "promo_global_discount"
  | "usage_nudge_followup"
  | "promo_personal_flash";

export type EmailCampaignRecipientMode = "all_clients" | "single";

export type EmailTemplateVariableKey =
  | "couponCode"
  | "discountPercent"
  | "offerDataGb"
  | "offerPriceUsd"
  | "welcomeBonusGb"
  | "orderReference"
  | "offerWindow";

export type EmailTemplateVariables = Partial<Record<EmailTemplateVariableKey, string>>;

export type EmailCampaignTemplateField = {
  key: EmailTemplateVariableKey;
  label: string;
  placeholder: string;
  description: string;
  defaultValue: string;
  required?: boolean;
};

export type EmailCampaignTemplate = {
  id: EmailCampaignTemplateId;
  label: string;
  description: string;
  recommendedMode: EmailCampaignRecipientMode;
  requiresRecipientName?: boolean;
  fields: EmailCampaignTemplateField[];
};

const templateCatalog: EmailCampaignTemplate[] = [
  {
    id: "promo_global_discount",
    label: "Global Promo Blast",
    description:
      "High-converting promotional campaign with a guaranteed 50% coupon, 4GB for $10, and a welcome data bonus.",
    recommendedMode: "all_clients",
    fields: [
      {
        key: "couponCode",
        label: "Coupon code",
        placeholder: "HALFOFF50",
        description: "Code customers will enter at checkout.",
        defaultValue: "HALFOFF50",
        required: true,
      },
      {
        key: "discountPercent",
        label: "Discount %",
        placeholder: "50",
        description: "Displayed in the subject and body copy.",
        defaultValue: "50",
        required: true,
      },
      {
        key: "offerDataGb",
        label: "Offer data (GB)",
        placeholder: "4",
        description: "Main bundle size shown in the offer.",
        defaultValue: "4",
        required: true,
      },
      {
        key: "offerPriceUsd",
        label: "Offer price (USD)",
        placeholder: "10",
        description: "Price shown in the campaign.",
        defaultValue: "10",
        required: true,
      },
      {
        key: "welcomeBonusGb",
        label: "Welcome bonus (GB)",
        placeholder: "1",
        description: "Bonus data for new/re-engaged buyers.",
        defaultValue: "1",
        required: true,
      },
    ],
  },
  {
    id: "usage_nudge_followup",
    label: "Unused Traffic Follow-Up",
    description:
      "Friendly check-in email for clients who bought recently but have not started using traffic yet.",
    recommendedMode: "single",
    fields: [
      {
        key: "orderReference",
        label: "Order reference (optional)",
        placeholder: "ORD-1042",
        description: "Optional order ID or short note shown in the email.",
        defaultValue: "",
      },
    ],
  },
  {
    id: "promo_personal_flash",
    label: "Personalized VIP Flash Offer",
    description:
      "Personalized one-to-one offer designed to feel exclusive, urgent, and tailored to a single client.",
    recommendedMode: "single",
    requiresRecipientName: true,
    fields: [
      {
        key: "couponCode",
        label: "Coupon code",
        placeholder: "GRAND201",
        description: "Exclusive code for the client.",
        defaultValue: "GRAND201",
        required: true,
      },
      {
        key: "offerDataGb",
        label: "Offer data (GB)",
        placeholder: "5",
        description: "Bundle size for the private offer.",
        defaultValue: "5",
        required: true,
      },
      {
        key: "offerPriceUsd",
        label: "Offer price (USD)",
        placeholder: "10",
        description: "Price shown for the private offer.",
        defaultValue: "10",
        required: true,
      },
      {
        key: "offerWindow",
        label: "Offer window",
        placeholder: "Tonight at midnight",
        description: "Urgency copy for expiration timing.",
        defaultValue: "Tonight at midnight",
        required: true,
      },
    ],
  },
];

export const EMAIL_CAMPAIGN_TEMPLATES = templateCatalog;

type RenderInput = {
  recipientName?: string | null;
  recipientEmail?: string | null;
  variables?: EmailTemplateVariables | null;
  supportEmail?: string | null;
  whatsappContact?: string | null;
};

type RenderedTemplate = {
  subject: string;
  text: string;
  html: string;
};

function sanitize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstNameFromEmail(email?: string | null) {
  const source = sanitize(email);
  if (!source.includes("@")) {
    return "";
  }

  const localPart = source.split("@")[0] || "";
  if (!localPart) {
    return "";
  }

  const normalized = localPart.replace(/[._-]+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function resolveName(recipientName?: string | null, recipientEmail?: string | null) {
  const explicit = sanitize(recipientName);
  if (explicit) {
    return explicit;
  }

  const inferred = firstNameFromEmail(recipientEmail);
  return inferred || "there";
}

function resolveTemplateById(templateId: EmailCampaignTemplateId) {
  const match = templateCatalog.find((entry) => entry.id === templateId);
  if (!match) {
    throw new Error("Unknown email template.");
  }

  return match;
}

function resolveTemplateVariables(
  templateId: EmailCampaignTemplateId,
  variables?: EmailTemplateVariables | null,
) {
  const template = resolveTemplateById(templateId);
  const resolved: Record<EmailTemplateVariableKey, string> = {
    couponCode: "",
    discountPercent: "",
    offerDataGb: "",
    offerPriceUsd: "",
    welcomeBonusGb: "",
    orderReference: "",
    offerWindow: "",
  };

  for (const field of template.fields) {
    const value = sanitize(variables?.[field.key]) || field.defaultValue;
    resolved[field.key] = value;
  }

  return resolved;
}

function wrapHtml({
  preview,
  headline,
  body,
  ctaLabel,
}: {
  preview: string;
  headline: string;
  body: string[];
  ctaLabel: string;
}) {
  const safePreview = escapeHtml(preview);
  const safeHeadline = escapeHtml(headline);
  const safeBody = body.map((entry) => `<p style="margin:0 0 14px;color:#0f172a;line-height:1.65;font-size:15px;">${escapeHtml(entry)}</p>`).join("");

  return `
<!doctype html>
<html>
  <head>
    <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safePreview}</title>
  </head>
  <body style="margin:0;background:#f4f7fb;padding:28px 14px;font-family:Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:650px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:26px;background:linear-gradient(135deg,#0f172a,#0f766e);color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#d1fae5;">FacelessProxy</p>
          <h1 style="margin:0;font-size:26px;line-height:1.2;">${safeHeadline}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 26px 26px;">
          ${safeBody}
          <p style="margin:20px 0 0;">
            <span style="display:inline-block;background:#0f172a;color:#ffffff;padding:11px 16px;border-radius:999px;font-size:13px;font-weight:600;">
              ${escapeHtml(ctaLabel)}
            </span>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 26px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
            You are receiving this message because you have an account or order history with FacelessProxy.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function getEmailCampaignTemplateById(templateId: string) {
  return templateCatalog.find((template) => template.id === templateId) ?? null;
}

export function getDefaultTemplateVariables(templateId: EmailCampaignTemplateId): EmailTemplateVariables {
  const template = resolveTemplateById(templateId);
  const defaults: EmailTemplateVariables = {};

  for (const field of template.fields) {
    defaults[field.key] = field.defaultValue;
  }

  return defaults;
}

export function renderEmailCampaignTemplate(
  templateId: EmailCampaignTemplateId,
  input: RenderInput = {},
): RenderedTemplate {
  const values = resolveTemplateVariables(templateId, input.variables);
  const firstName = resolveName(input.recipientName, input.recipientEmail);
  const supportEmail = sanitize(input.supportEmail) || "support@facelessproxy.com";
  const whatsappContact = sanitize(input.whatsappContact) || "our WhatsApp support line";

  if (templateId === "promo_global_discount") {
    const subject = `Guaranteed ${values.discountPercent}% Off + ${values.welcomeBonusGb}GB Bonus Is Live`;
    const lines = [
      `Hi ${firstName},`,
      `Your next proxy purchase now comes with a guaranteed ${values.discountPercent}% discount.`,
      `Use code ${values.couponCode} to activate ${values.offerDataGb}GB for only $${values.offerPriceUsd}, and we will stack an extra ${values.welcomeBonusGb}GB welcome bonus on top.`,
      "This promo is available for Freelancer Residential, Mobile, and Datacenter proxy plans.",
      `Need help picking the right package? Reply here and our team will guide you. (${supportEmail})`,
    ];

    return {
      subject,
      text: lines.join("\n\n"),
      html: wrapHtml({
        preview: subject,
        headline: "Your New High-Performance Proxy Deal Is Ready",
        body: lines,
        ctaLabel: `Use code ${values.couponCode}`,
      }),
    };
  }

  if (templateId === "usage_nudge_followup") {
    const orderNote = values.orderReference
      ? `For reference, we flagged this on order ${values.orderReference}.`
      : "We flagged this after a quick account health check on your latest purchase.";
    const subject = "Quick Check-In: Your Proxy Traffic Is Still Waiting";
    const lines = [
      `Hi ${firstName},`,
      "We noticed you recently placed an order, but your traffic usage appears to still be at zero.",
      "If setup is blocked, we can help you configure everything in minutes.",
      orderNote,
      `Message us on WhatsApp (${whatsappContact}) or email ${supportEmail} and we will troubleshoot with you right away.`,
      "If you have already started usage, feel free to ignore this note.",
    ];

    return {
      subject,
      text: lines.join("\n\n"),
      html: wrapHtml({
        preview: subject,
        headline: "Let's Get Your Proxy Traffic Moving",
        body: lines,
        ctaLabel: "Reply for setup support",
      }),
    };
  }

  const subject = `${firstName}, your private offer: ${values.offerDataGb}GB for $${values.offerPriceUsd}`;
  const lines = [
    `Hi ${firstName},`,
    "We reserved a private offer for your account that is not listed publicly.",
    `Get ${values.offerDataGb}GB for only $${values.offerPriceUsd} using code ${values.couponCode}.`,
    `This private pricing expires ${values.offerWindow}.`,
    "If you want us to help you select the fastest pool for your use case, just reply and our team will handle it.",
  ];

  return {
    subject,
    text: lines.join("\n\n"),
    html: wrapHtml({
      preview: subject,
      headline: "A Private Deal Reserved For You",
      body: lines,
      ctaLabel: `Redeem ${values.couponCode}`,
    }),
  };
}

