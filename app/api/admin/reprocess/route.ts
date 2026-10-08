import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FLOW_EVENT_TYPES, processInteraktPayload, type InteraktPayload } from "@/lib/interakt-webhook";

// Admin-only (proxy.ts). Re-runs logged Interakt submissions that didn't become leads,
// e.g. after a mapping fix. Already-saved submissions come back as "duplicate".
export async function POST() {
  const events = await prisma.webhookEvent.findMany({
    where: {
      provider: "interakt",
      eventType: { in: FLOW_EVENT_TYPES },
      status: { in: ["invalid", "not_flow", "ignored", "error"] },
    },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });

  const summary: Record<string, number> = {};
  for (const e of events) {
    let result;
    try {
      result = await processInteraktPayload(e.payload as InteraktPayload);
    } catch (err) {
      result = { status: "error", error: String(err) };
    }
    summary[result.status] = (summary[result.status] ?? 0) + 1;
    await prisma.webhookEvent.update({
      where: { id: e.id },
      data: { status: result.status, error: result.error?.slice(0, 500) ?? null, leadId: result.leadId ?? null },
    });
  }
  return NextResponse.json({ processed: events.length, summary });
}
