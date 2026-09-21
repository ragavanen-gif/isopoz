import "server-only";
import nodemailer from "nodemailer";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getTransport() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

export type Attachment = { filename: string; content: Buffer; contentType?: string };

export type SendResult = { ok: true } | { ok: false; error: string };

/** Envoie un email via le SMTP configuré (Hostinger). */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
  replyTo?: string;
}): Promise<SendResult> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Envoi d'emails non configuré (variables SMTP manquantes)." };
  }
  try {
    const from = process.env.SMTP_FROM || `ISOPoz <${process.env.SMTP_USER}>`;
    await getTransport().sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] échec envoi:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Échec de l'envoi." };
  }
}
