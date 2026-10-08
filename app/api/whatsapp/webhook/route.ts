import { createHmac, timingSafeEqual } from "crypto";
import { validateLead } from "@/lib/lead";
import { saveLead } from "@/lib/save-lead";
import { mapFlowAnswers } from "@/lib/flow-answers";

// Meta webhook verification: GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function validSignature(body: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type FlowMessage = {
  id: string;
  from: string;
  type: string;
  interactive?: { type: string; nfm_reply?: { response_json: string } };
};

// Flow submissions arrive as messages of type interactive -> nfm_reply.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: { entry?: { changes?: { value?: { messages?: FlowMessage[] } }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const messages = (payload.entry ?? [])
    .flatMap((e) => e.changes ?? [])
    .flatMap((c) => c.value?.messages ?? [])
    .filter((m) => m.type === "interactive" && m.interactive?.type === "nfm_reply");

  for (const msg of messages) {
    let answers: Record<string, unknown>;
    try {
      answers = JSON.parse(msg.interactive!.nfm_reply!.response_json);
    } catch {
      console.error("Unparseable response_json", msg.id);
      continue;
    }

    // Mobile number comes from the WhatsApp sender, not the form.
    const mapped = mapFlowAnswers(answers);
    const { data, errors } = validateLead({ ...mapped, phone: msg.from });
    if (!data) {
      console.error("Incomplete Flow submission", msg.id, errors);
      continue;
    }

    try {
      await saveLead(data, {
        source: "whatsapp_flow",
        consent: mapped.consent === true,
        answers,
        waMessageId: msg.id,
        flowToken: typeof answers.flow_token === "string" ? answers.flow_token : undefined,
      });
    } catch (err) {
      console.error("Failed to save Flow lead", msg.id, err);
      return new Response("Error", { status: 500 }); // let Meta retry
    }
  }

  return new Response("OK", { status: 200 });
}
