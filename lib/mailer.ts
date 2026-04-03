import "server-only";

import nodemailer from "nodemailer";

type MailerConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
};

export type SendEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type MailTransporter = {
  sendMail: (payload: {
    from: string;
    to: string;
    replyTo: string;
    subject: string;
    text: string;
    html: string;
  }) => Promise<unknown>;
};

let cachedTransporter: MailTransporter | null = null;
let cachedConfig: MailerConfig | null = null;

function sanitize(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value?: string | null) {
  const normalized = sanitize(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function readMailerConfig(): MailerConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const host = sanitize(process.env.MAILER_SMTP_HOST);
  const port = Number(process.env.MAILER_SMTP_PORT || 0) || 465;
  const secure = parseBoolean(process.env.MAILER_SMTP_SECURE) || port === 465;
  const user = sanitize(process.env.MAILER_SMTP_USER);
  const pass = sanitize(process.env.MAILER_SMTP_PASS);
  const fromEmail = sanitize(process.env.MAILER_FROM_EMAIL) || user;
  const fromName = sanitize(process.env.MAILER_FROM_NAME) || "FacelessProxy";
  const replyTo = sanitize(process.env.MAILER_REPLY_TO) || fromEmail;

  const missing: string[] = [];
  if (!host) missing.push("MAILER_SMTP_HOST");
  if (!user) missing.push("MAILER_SMTP_USER");
  if (!pass) missing.push("MAILER_SMTP_PASS");
  if (!fromEmail) missing.push("MAILER_FROM_EMAIL");

  if (missing.length > 0) {
    throw new Error(`Email sender is not configured. Missing environment values: ${missing.join(", ")}`);
  }

  cachedConfig = {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
    replyTo,
  };

  return cachedConfig;
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = readMailerConfig();
  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
}

export function getSupportEmailContact() {
  const config = readMailerConfig();
  return config.replyTo || config.fromEmail;
}

export function getSupportWhatsappContact() {
  return sanitize(process.env.MAILER_SUPPORT_WHATSAPP || process.env.SUPPORT_WHATSAPP);
}

export async function sendEmail(payload: SendEmailPayload) {
  const config = readMailerConfig();
  const transporter = getTransporter();

  return transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: payload.to,
    replyTo: config.replyTo || config.fromEmail,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}
