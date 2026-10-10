import { createHmac, timingSafeEqual } from "crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { processInteraktPayload, type InteraktPayload } from "@/lib/interakt-webhook";
import { isStatusEvent, processStatusEvent } from "@/lib/interakt-status";
import { sendText } from "@/lib/interakt";

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
  let payload: InteraktPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    await log(undefined, "bad_json", { raw: raw.slice(0, 5000) });
    return ok();
  }

  if (!validSignature(raw, req.headers.get("interakt-signature"))) {
    // Logged (not processed) so a secret mismatch is visible instead of silently losing leads.
    await log(payload.type, "bad_signature", payload, `header: ${req.headers.get("interakt-signature") ?? "missing"}`);
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    const result = isStatusEvent(payload.type)
      ? await processStatusEvent(payload as Parameters<typeof processStatusEvent>[0])
      : await processInteraktPayload(payload);
    await log(payload.type, result.status, payload, result.error, result.leadId);

    // Thank the user once per submission (Interakt sends each submission as two events; only one is "saved").
    const thanks = process.env.WA_THANK_YOU_MESSAGE;
    if (result.status === "saved" && result.phone && thanks) {
      const { phone, leadId } = result;
      after(async () => {
        const sent = await sendText(phone, thanks, leadId);
        if (!sent.ok) await log("thank_you", "thanks_failed", { phone, leadId }, sent.error, leadId);
      });
    }
  } catch (err) {
    console.error("Failed to process Interakt webhook", err);
    await log(payload.type, "error", payload, String(err));
  }
  return ok();
}
