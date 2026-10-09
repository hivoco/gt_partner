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

export async function sendTemplate(phone: string, callbackData?: string): Promise<SendResult> {
  const apiKey = process.env.INTERAKT_API_KEY;
  const template = process.env.INTERAKT_TEMPLATE_NAME;
  if (!apiKey || !template) return { ok: false, error: "INTERAKT_API_KEY / INTERAKT_TEMPLATE_NAME not set" };

  try {
    const res = await fetch(process.env.INTERAKT_API_URL ?? "https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: { Authorization: `Basic ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        countryCode: "+91",
        phoneNumber: phone,
        type: "Template",
        callbackData, // echoed back in Interakt's delivery webhooks
        template: {
          name: template,
          languageCode: process.env.INTERAKT_TEMPLATE_LANG ?? "en",
          ...mediaHeader(),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.result !== false) return { ok: true, id: body.id };
    return { ok: false, error: `HTTP ${res.status}: ${body.message ?? JSON.stringify(body)}`.slice(0, 255) };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 255) };
  }
}
