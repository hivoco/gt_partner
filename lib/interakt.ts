// Sends an approved WhatsApp template through Interakt's public API.
// https://www.interakt.shop/resource-center/send-template-message-api

// Image/video/document header for templates that have one. fileName is only used for documents.
function mediaHeader() {
  const url = process.env.INTERAKT_HEADER_MEDIA_URL;
  if (!url) return {};
  const fileName = process.env.INTERAKT_HEADER_FILE_NAME;
  return { headerValues: [url], ...(fileName ? { fileName } : {}) };
}

type SendResult = { ok: true; id?: string } | { ok: false; error: string };

async function post(body: Record<string, unknown>): Promise<SendResult> {
  const apiKey = process.env.INTERAKT_API_KEY;
  if (!apiKey) return { ok: false, error: "INTERAKT_API_KEY not set" };

  try {
    const res = await fetch(process.env.INTERAKT_API_URL ?? "https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: { Authorization: `Basic ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode: "+91", ...body }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.result !== false) return { ok: true, id: json.id };
    return { ok: false, error: `HTTP ${res.status}: ${json.message ?? JSON.stringify(json)}`.slice(0, 255) };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 255) };
  }
}

export async function sendTemplate(phone: string, callbackData?: string): Promise<SendResult> {
  const template = process.env.INTERAKT_TEMPLATE_NAME;
  if (!template) return { ok: false, error: "INTERAKT_TEMPLATE_NAME not set" };
  return post({
    phoneNumber: phone,
    type: "Template",
    callbackData, // echoed back in Interakt's delivery webhooks
    template: {
      name: template,
      languageCode: process.env.INTERAKT_TEMPLATE_LANG ?? "en",
      ...mediaHeader(),
    },
  });
}

// Free-text message. Only delivered inside WhatsApp's 24h window after the user last messaged us.
export async function sendText(phone: string, message: string, callbackData?: string): Promise<SendResult> {
  return post({ phoneNumber: phone, type: "Text", callbackData, data: { message } });
}
