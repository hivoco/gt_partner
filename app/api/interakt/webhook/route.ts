import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateLead } from "@/lib/lead";
import { saveLead } from "@/lib/save-lead";
import { findFlowAnswers, mapFlowAnswers } from "@/lib/flow-answers";

/**
 * Interakt webhook (Developer Settings → Webhook URL):
 *   https://<domain>/api/interakt/webhook
 * Saves WhatsApp Flow submissions as leads. Interakt disables a webhook after repeated
 * non-200s, so anything we can't use is logged to webhook_events and still answered 200.
 */

function validSignature(body: string, header: string | null) {
  const secret = process.env.INTERAKT_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type InteraktPayload = {
  type?: string;
  data?: {
    customer?: { channel_phone_number?: string; phone_number?: string; country_code?: string };
    message?: { id?: string; message_content_type?: string };
  };
};

const ok = () => new Response("OK", { status: 200 });

async function log(eventType: string | undefined, status: string, payload: unknown, error?: string, leadId?: string) {
  await prisma.webhookEvent
    .create({
      data: { provider: "interakt", eventType, status, error: error?.slice(0, 500), leadId, payload: payload as object },
    })
    .catch((err) => console.error("Failed to log Interakt webhook", err));
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("interakt-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: InteraktPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return ok();
  }

  // Only customer messages can carry a Flow submission; ignore delivery/status events.
  if (payload.type !== "message_received") return ok();

  const answers = findFlowAnswers(payload.data?.message ?? payload.data);
  if (!answers) {
    await log(payload.type, "not_flow", payload);
    return ok();
  }

  const customer = payload.data?.customer ?? {};
  const phone =
    customer.channel_phone_number ?? `${customer.country_code ?? ""}${customer.phone_number ?? ""}`;
  const mapped = mapFlowAnswers(answers);
  const { data, errors } = validateLead({ ...mapped, phone });
  if (!data) {
    await log(payload.type, "invalid", payload, JSON.stringify(errors));
    return ok();
  }

  try {
    const messageId = payload.data?.message?.id;
    const existing = messageId ? await prisma.lead.findUnique({ where: { waMessageId: messageId } }) : null;
    const lead =
      existing ??
      (await saveLead(data, {
        source: "whatsapp_flow",
        consent: mapped.consent === true,
        answers,
        waMessageId: messageId,
        flowToken: typeof answers.flow_token === "string" ? answers.flow_token : undefined,
      }));
    await log(payload.type, existing ? "duplicate" : "saved", payload, undefined, lead.id);
  } catch (err) {
    console.error("Failed to save Interakt lead", err);
    await log(payload.type, "error", payload, String(err));
  }
  return ok();
}
