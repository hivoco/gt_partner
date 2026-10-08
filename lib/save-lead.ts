import { prisma } from "./prisma";
import type { LeadInput } from "./lead";

type Extra = {
  source: string;
  consent?: boolean;
  waMessageId?: string;
  flowToken?: string;
  answers?: Record<string, unknown>;
  callSid?: string; // exact call, when known (Interakt callback_data)
  submittedAt?: Date; // when the user submitted, if the provider tells us
};

// Saves a validated lead, flags repeat registrations and links it to the caller's latest missed call.
export async function saveLead(data: LeadInput, extra: Extra) {
  if (extra.waMessageId) {
    const existing = await prisma.lead.findUnique({ where: { waMessageId: extra.waMessageId } });
    if (existing) return existing; // Meta retried the webhook
  }

  const [previous, call] = await Promise.all([
    prisma.lead.findFirst({ where: { phone: data.phone }, select: { id: true } }),
    prisma.call.findFirst({
      where: { phone: data.phone },
      orderBy: { createdAt: "desc" },
      select: { callSid: true },
    }),
  ]);

  const lead = await prisma.lead.create({
    data: {
      ...data,
      existingRetailer: data.existingRetailer === "Yes",
      consent: extra.consent ?? false,
      source: extra.source.slice(0, 50),
      duplicate: !!previous,
      callSid: extra.callSid ?? call?.callSid,
      waMessageId: extra.waMessageId,
      flowToken: extra.flowToken?.slice(0, 128),
      answers: extra.answers as object | undefined,
      createdAt: extra.submittedAt,
    },
  });

  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, existingRetailer: data.existingRetailer }),
    }).catch((err) => console.error("Lead webhook failed", err));
  }

  return lead;
}
