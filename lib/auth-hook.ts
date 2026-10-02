import { createHmac, timingSafeEqual } from "node:crypto";
import { safeNextPath } from "@/lib/buyer/paths";
import { absoluteSiteUrl, siteConfig } from "@/lib/config";
import { sendEricMail } from "@/lib/mail";

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  token_new: string;
  token_hash_new: string;
};

export type AuthHookPayload = {
  user: { email?: string };
  email_data: EmailData;
};

const MAX_SKEW_SECONDS = 5 * 60;

export function verifyAuthHook(rawBody: string, headers: Headers): boolean {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET?.trim() ?? "";
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!secret || !id || !timestamp || !signature) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > MAX_SKEW_SECONDS) return false;

  const encoded = secret.startsWith("v1,whsec_") ? secret.slice("v1,whsec_".length) : secret;
  const key = Buffer.from(encoded, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  const expectedBuf = Buffer.from(expected);

  return signature.split(" ").some((part) => {
    const value = part.startsWith("v1,") ? part.slice(3) : part;
    const got = Buffer.from(value);
    return got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf);
  });
}

function confirmLink(data: EmailData): string {
  let next = "/account";
  try {
    next = safeNextPath(new URL(data.redirect_to).searchParams.get("next"), "/account");
  } catch {
    next = "/account";
  }
  if (data.email_action_type === "recovery") next = "/account/reset";
  const params = new URLSearchParams({
    token_hash: data.token_hash,
    type: data.email_action_type,
    next,
  });
  return absoluteSiteUrl(`/account/confirm?${params.toString()}`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function letter(input: { lead: string; action?: string; href?: string; code?: string }): { text: string; html: string } {
  const signature = `Eric Adams\nBuySellEric\nGreensboro, Georgia\n${siteConfig.phoneDisplay}`;
  const textLines = [input.lead, ""];
  if (input.href && input.action) {
    textLines.push(`${input.action}:`, input.href, "");
  }
  if (input.code) {
    textLines.push(`Your code is ${input.code}`, "");
  }
  textLines.push("If you did not ask for this, you can ignore this email.", "", signature);
  const text = textLines.join("\n");

  const actionHtml =
    input.href && input.action
      ? `<p><a href="${escapeHtml(input.href)}">${escapeHtml(input.action)}</a></p><p>${escapeHtml(input.href)}</p>`
      : "";
  const codeHtml = input.code ? `<p>Your code is <strong>${escapeHtml(input.code)}</strong></p>` : "";
  const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1a2433">
<p>${escapeHtml(input.lead)}</p>
${actionHtml}
${codeHtml}
<p>If you did not ask for this, you can ignore this email.</p>
<p>Eric Adams<br>BuySellEric<br>Greensboro, Georgia<br>${escapeHtml(siteConfig.phoneDisplay)}</p>
</div>`;
  return { text, html };
}

export async function sendAuthHookEmail(payload: AuthHookPayload): Promise<boolean> {
  const email = payload.user.email?.trim() ?? "";
  const data = payload.email_data;
  if (!email) return false;

  const kind = data.email_action_type;
  if (kind === "reauthentication") {
    const body = letter({
      lead: "Eric here. Use this code to confirm it's you.",
      code: data.token,
    });
    return sendEricMail({
      to: email,
      subject: "Your BuySellEric verification code",
      text: body.text,
      html: body.html,
    });
  }

  const href = confirmLink(data);
  const copy: Record<string, { subject: string; lead: string; action: string }> = {
    signup: {
      subject: "Confirm your BuySellEric account",
      lead: "Eric here. Confirm your email and you can save homes, tell me what you want, and book time.",
      action: "Confirm my account",
    },
    recovery: {
      subject: "Reset your BuySellEric password",
      lead: "Eric here. Use this link to choose a new password.",
      action: "Choose a new password",
    },
    magiclink: {
      subject: "Your BuySellEric sign-in link",
      lead: "Eric here. Use this link to log in.",
      action: "Log in",
    },
    invite: {
      subject: "You're invited to BuySellEric",
      lead: "Eric here. Accept this invite to create your account.",
      action: "Accept invite",
    },
    email_change: {
      subject: "Confirm your new email",
      lead: "Eric here. Confirm this email for your BuySellEric account.",
      action: "Confirm email",
    },
  };
  const message = copy[kind] ?? {
    subject: "A note from Eric at BuySellEric",
    lead: "Eric here. Use this link to continue.",
    action: "Continue",
  };
  const body = letter({ lead: message.lead, action: message.action, href });
  return sendEricMail({
    to: email,
    subject: message.subject,
    text: body.text,
    html: body.html,
  });
}
