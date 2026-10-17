import "server-only";
import nodemailer from "nodemailer";

export type InvitationDeliveryResult = {
  accepted: boolean;
  message: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

function trustedInvitationUrl(path: string): string | null {
  if (!/^\/invite\/[A-Za-z0-9_-]{20,150}$/.test(path)) return null;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  try {
    const base = new URL(configured);
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/") return null;
    if (process.env.NODE_ENV === "production" && base.protocol !== "https:") return null;
    if (!["https:", "http:"].includes(base.protocol)) return null;
    return new URL(path, base.origin).toString();
  } catch {
    return null;
  }
}

/**
 * SMTP accept means the configured relay took responsibility for the message.
 * It is NOT proof of inbox delivery. Never log the one-time token or message body.
 */
export async function sendWorkspaceInvitationEmail(input: {
  recipient: string;
  invitedName: string | null;
  organizationName: string;
  role: string;
  invitationPath: string;
}): Promise<InvitationDeliveryResult> {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  const url = trustedInvitationUrl(input.invitationPath);

  if (!smtpHost || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535
    || !smtpUser || !smtpPassword || !from || !url) {
    return {
      accepted: false,
      message: "Email sending is not fully configured. Copy the one-time invitation link and deliver it securely.",
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient)) {
    return { accepted: false, message: "The invitation email address is invalid." };
  }

  const roleName = input.role.replaceAll("_", " ");
  const name = input.invitedName?.trim() || "Administrator";
  const subject = `Your VIMS invitation — ${input.organizationName}`;
  const text = `Hello ${name},

You are invited to join ${input.organizationName} on the Vehicle Inspection Management System (VIMS) as ${roleName}.

Open this secure one-time link to create your account:
${url}

The invitation expires seven days after issuance and can only be used once. If you did not expect this invitation, ignore this email.

VIMS Account Support`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
  <h2>You're invited to VIMS</h2>
  <p>Hello ${escapeHtml(name)},</p>
  <p><strong>${escapeHtml(input.organizationName)}</strong> has invited you to join VIMS as <strong>${escapeHtml(roleName)}</strong>.</p>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#047857;color:white;border-radius:8px;text-decoration:none">Accept invitation</a></p>
  <p>For your security, this one-time link expires seven days after issuance and can be used only once.</p>
  <p>If you did not expect this invitation, you can ignore it.</p>
  </div>`;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort !== 465,
    auth: { user: smtpUser, pass: smtpPassword },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { minVersion: "TLSv1.2" },
    logger: false,
    debug: false,
  });
  try {
    const info = await transporter.sendMail({
      from,
      to: input.recipient,
      subject,
      text,
      html,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const accepted = info.accepted.some((address) => address.toLowerCase() === input.recipient.toLowerCase());
    return accepted
      ? { accepted: true, message: "Invitation accepted by the mail server. Check the recipient inbox and spam folder; inbox delivery is not yet confirmed." }
      : { accepted: false, message: "The mail server did not accept the recipient. Copy the one-time link and send it securely." };
  } catch (error) {
    // Log only a short classified mailer error; SMTP responses, URLs and tokens
    // may contain private details and must never reach application logs.
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code).slice(0, 40)
      : "unknown";
    console.warn("VIMS invitation SMTP delivery failed", { code });
    return {
      accepted: false,
      message: "Invitation saved, but the email service did not accept it. Copy the one-time invitation link and send it securely.",
    };
  } finally {
    transporter.close();
  }
}
