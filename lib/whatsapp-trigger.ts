import { prisma } from "./prisma";
import { sendTemplate } from "./interakt";

// Don't re-send to someone who got the template recently (repeat missed calls). 0 disables.
const RESEND_HOURS = Number(process.env.WA_RESEND_HOURS ?? 24);

export async function triggerWhatsApp(callSid: string, phone: string) {
  if (!process.env.INTERAKT_API_KEY) return;

  // Claim the call so repeated Passthru hits for the same CallSid send only once.
  const claimed = await prisma.call.updateMany({ where: { callSid, waStatus: null }, data: { waStatus: "pending" } });
  if (!claimed.count) return;

  if (RESEND_HOURS > 0) {
    const recent = await prisma.call.findFirst({
      where: { phone, waStatus: "sent", waSentAt: { gte: new Date(Date.now() - RESEND_HOURS * 3600_000) } },
      select: { callSid: true },
    });
    if (recent) {
      await prisma.call.update({
        where: { callSid },
        data: { waStatus: "skipped", waError: `Already sent in last ${RESEND_HOURS}h (call ${recent.callSid})` },
      });
      return;
    }
  }

  const result = await sendTemplate(phone, callSid);
  await prisma.call.update({
    where: { callSid },
    data: result.ok
      ? { waStatus: "sent", waMessageId: result.id ?? null, waSentAt: new Date(), waError: null }
      : { waStatus: "failed", waError: result.error },
  });
  if (!result.ok) console.error("WhatsApp send failed", callSid, result.error);
}
