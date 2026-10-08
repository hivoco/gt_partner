import { prisma } from "./prisma";
import type { ProcessResult } from "./interakt-webhook";

// Interakt delivery reports (message_api_sent / _delivered / _read / _failed) for templates we sent.
type StatusPayload = {
  type?: string;
  data?: {
    message?: {
      id?: string;
      message_status?: string;
      delivered_at_utc?: string | null;
      seen_at_utc?: string | null;
      channel_error_code?: string | number | null;
      channel_failure_reason?: string | null;
      meta_data?: { source_data?: { callback_data?: string } };
    };
  };
};

const RANK: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };

const utc = (s?: string | null) => {
  if (!s) return undefined;
  const d = new Date(s.endsWith("Z") ? s : `${s}Z`);
  return isNaN(d.getTime()) ? undefined : d;
};

export function isStatusEvent(type?: string) {
  return !!type && /^message_api_(sent|delivered|read|failed)$/.test(type);
}

export async function processStatusEvent(payload: StatusPayload): Promise<ProcessResult> {
  const msg = payload.data?.message;
  const callSid = msg?.meta_data?.source_data?.callback_data;
  const call = await prisma.call.findFirst({
    where: { OR: [...(msg?.id ? [{ waMessageId: msg.id }] : []), ...(callSid ? [{ callSid }] : [])] },
    select: { callSid: true, waStatus: true, waDeliveredAt: true, waReadAt: true },
  });
  if (!call) return { status: "status_unmatched" };

  const next = payload.type!.replace("message_api_", "");
  const data: Record<string, unknown> = {};

  if (next === "failed") {
    const reason = [msg?.channel_failure_reason, msg?.channel_error_code && `code ${msg.channel_error_code}`]
      .filter(Boolean)
      .join(" · ");
    data.waStatus = "failed";
    data.waError = (reason || "Failed (no reason given by Interakt)").slice(0, 255);
  } else if (call.waStatus !== "failed" && (RANK[next] ?? 0) > (RANK[call.waStatus ?? ""] ?? -1)) {
    // Reports can arrive out of order; never move backwards (read → delivered).
    data.waStatus = next;
  }
  if (!call.waDeliveredAt && (next === "delivered" || next === "read")) data.waDeliveredAt = utc(msg?.delivered_at_utc) ?? new Date();
  if (!call.waReadAt && next === "read") data.waReadAt = utc(msg?.seen_at_utc) ?? new Date();

  if (Object.keys(data).length) await prisma.call.update({ where: { callSid: call.callSid }, data });
  return { status: "status_updated" };
}
