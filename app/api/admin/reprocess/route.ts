import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FLOW_EVENT_TYPES, processInteraktPayload, type InteraktPayload, type ProcessResult } from "@/lib/interakt-webhook";
import { isStatusEvent, processStatusEvent } from "@/lib/interakt-status";

const STATUS_TYPES = ["message_api_sent", "message_api_delivered", "message_api_read", "message_api_failed"];

// Admin-only (proxy.ts). Re-runs logged Interakt events that weren't applied: Flow submissions
// that didn't become leads, and delivery reports logged before they were tracked.
// Already-saved submissions come back as "duplicate".
export async function POST() {
  const events = await prisma.webhookEvent.findMany({
    where: {
      provider: "interakt",
      eventType: { in: [...FLOW_EVENT_TYPES, ...STATUS_TYPES] },
      status: { in: ["invalid", "not_flow", "ignored", "error", "status_unmatched"] },
    },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });

  const summary: Record<string, number> = {};
  for (const e of events) {
    let result: ProcessResult;
    try {
      result = isStatusEvent(e.eventType ?? undefined)
        ? await processStatusEvent(e.payload as Parameters<typeof processStatusEvent>[0])
        : await processInteraktPayload(e.payload as InteraktPayload);
    } catch (err) {
      result = { status: "error", error: String(err) };
    }
    summary[result.status] = (summary[result.status] ?? 0) + 1;
    await prisma.webhookEvent.update({
      where: { id: e.id },
      data: {
        status: result.status,
        error: result.error?.slice(0, 500) ?? null,
        leadId: result.leadId ?? null,
      },
    });
  }
  return NextResponse.json({ processed: events.length, summary });
}
