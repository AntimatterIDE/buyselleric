import { formatOfficeDateTime } from "@/lib/buyer/time";
import { APPOINTMENT_LABELS, type AppointmentType } from "@/lib/buyer/types";
import { siteConfig } from "@/lib/config";

const FROM = `Eric Adams <${siteConfig.email}>`;

type SendInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export async function sendEricMail(input: SendInput): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = input.to.trim();
  if (!key || !to) return false;

  const body: Record<string, unknown> = {
    from: FROM,
    to: [to],
    subject: input.subject,
    text: input.text,
  };
  if (input.html) body.html = input.html;
  if (input.replyTo) body.reply_to = input.replyTo;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "BuySellEric/1.0",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("sendEricMail", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendEricMail", err);
    return false;
  }
}

export async function mailEricAndGuest(input: {
  guestEmail: string;
  ericSubject: string;
  ericText: string;
  guestSubject: string;
  guestText: string;
}): Promise<void> {
  await Promise.all([
    sendEricMail({
      to: siteConfig.email,
      subject: input.ericSubject,
      text: input.ericText,
      replyTo: input.guestEmail,
    }),
    sendEricMail({
      to: input.guestEmail,
      subject: input.guestSubject,
      text: input.guestText,
    }),
  ]);
}

function appointmentLabel(type: string): string {
  if (type in APPOINTMENT_LABELS) return APPOINTMENT_LABELS[type as AppointmentType];
  return "Appointment";
}

function appointmentDetails(input: {
  type: string;
  startsAt: string;
  listingTitle?: string;
  listingAddress?: string;
  meetUrl?: string | null;
  note?: string;
}): string {
  const lines = [
    appointmentLabel(input.type),
    formatOfficeDateTime(input.startsAt),
  ];
  if (input.listingTitle) lines.push(input.listingTitle);
  if (input.listingAddress) lines.push(input.listingAddress);
  if (input.meetUrl) lines.push(`Meet: ${input.meetUrl}`);
  if (input.note?.trim()) lines.push(input.note.trim());
  return lines.join("\n");
}

export async function mailAppointmentUpdate(input: {
  buyerEmail: string;
  buyerName: string;
  type: string;
  startsAt: string;
  event: "requested" | "confirmed" | "declined" | "rescheduled" | "cancelled";
  listingTitle?: string;
  listingAddress?: string;
  meetUrl?: string | null;
  note?: string;
}): Promise<void> {
  const who = input.buyerName.trim() || "A buyer";
  const label = appointmentLabel(input.type).toLowerCase();
  const details = appointmentDetails(input);
  const phone = `You can also reach Eric at ${siteConfig.phoneDisplay}.`;

  const guestCopy: Record<typeof input.event, { subject: string; lead: string }> = {
    requested: {
      subject: "Eric has your request",
      lead: "Eric has your request. He will confirm it before it is on the calendar.",
    },
    confirmed: {
      subject: `Eric confirmed your ${label}`,
      lead: "You are confirmed. Eric will see you then.",
    },
    declined: {
      subject: "Eric needs a different time",
      lead: "Eric can't make that time. Reply to this email and he will find another.",
    },
    rescheduled: {
      subject: `Eric moved your ${label}`,
      lead: "Eric moved this to a new time.",
    },
    cancelled: {
      subject: "Your time with Eric is cancelled",
      lead: "This time is cancelled. Reply if you want to pick another.",
    },
  };
  const ericCopy: Record<typeof input.event, string> = {
    requested: `New ${label} request from ${who}`,
    confirmed: `Confirmed ${label} with ${who}`,
    declined: `Declined ${label} with ${who}`,
    rescheduled: `Rescheduled ${label} with ${who}`,
    cancelled: `Cancelled ${label} with ${who}`,
  };

  const guest = guestCopy[input.event];
  await mailEricAndGuest({
    guestEmail: input.buyerEmail,
    ericSubject: ericCopy[input.event],
    ericText: `${who}\n${input.buyerEmail}\n\n${details}`,
    guestSubject: guest.subject,
    guestText: `${guest.lead}\n\n${details}\n\n${phone}`,
  });
}
