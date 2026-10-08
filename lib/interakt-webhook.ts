import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { validateLead } from "./lead";
import { saveLead } from "./save-lead";
import { findFlowAnswers, mapFlowAnswers } from "./flow-answers";

export type InteraktPayload = {
  type?: string;
  data?: {
    customer?: { channel_phone_number?: string; phone_number?: string; country_code?: string };
    message?: { id?: string; message_content_type?: string; received_at_utc?: string };
    source_template_message?: { callback_data?: string };
  };
};

// Interakt sends each Flow submission twice: as message_received and as message_api_flow_response.
export const FLOW_EVENT_TYPES = ["message_received", "message_api_flow_response"];

export type ProcessResult = { status: string; error?: string; leadId?: string };

export async function processInteraktPayload(payload: InteraktPayload): Promise<ProcessResult> {
  if (!payload.type || !FLOW_EVENT_TYPES.includes(payload.type)) return { status: "ignored" };

  const answers = findFlowAnswers(payload.data?.message ?? payload.data);
  if (!answers) return { status: "not_flow" };

  const customer = payload.data?.customer ?? {};
  const phone = customer.channel_phone_number ?? `${customer.country_code ?? ""}${customer.phone_number ?? ""}`;
  const mapped = mapFlowAnswers(answers);
  const { data, errors } = validateLead({ ...mapped, phone });
  if (!data) return { status: "invalid", error: JSON.stringify(errors) };

  const messageId = payload.data?.message?.id;
  const existing = messageId
    ? await prisma.lead.findUnique({ where: { waMessageId: messageId }, select: { id: true } })
    : null;
  if (existing) return { status: "duplicate", leadId: existing.id };

  // callback_data is the Exotel CallSid we passed when sending the template.
  const callbackData = payload.data?.source_template_message?.callback_data;
  const call = callbackData
    ? await prisma.call.findUnique({ where: { callSid: callbackData }, select: { callSid: true } })
    : null;

  // Interakt timestamps are UTC without a zone marker.
  const receivedAt = payload.data?.message?.received_at_utc;
  const submittedAt = receivedAt ? new Date(receivedAt.endsWith("Z") ? receivedAt : `${receivedAt}Z`) : undefined;

  try {
    const lead = await saveLead(data, {
      source: "whatsapp_flow",
      consent: mapped.consent === true,
      answers,
      waMessageId: messageId,
      callSid: call?.callSid,
      submittedAt: submittedAt && !isNaN(submittedAt.getTime()) ? submittedAt : undefined,
      flowToken: typeof answers.flow_token === "string" ? answers.flow_token : undefined,
    });
    return { status: "saved", leadId: lead.id };
  } catch (err) {
    // Both events for one submission can arrive together; the second hits the unique message id.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { status: "duplicate" };
    throw err;
  }
}
