import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/lead";

/**
 * Exotel Passthru applet URL:
 *   https://<domain>/api/exotel/call?key=<EXOTEL_KEY>
 * Exotel calls it with CallSid, CallFrom, CallTo, Direction, CallType, StartTime, ... as query params.
 * Always answers 200 so the call flow carries on along the success branch.
 */
async function handle(req: Request) {
  const url = new URL(req.url);
  const params: Record<string, string> = Object.fromEntries(url.searchParams);
  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    form?.forEach((v, k) => typeof v === "string" && (params[k] = v));
  }

  const expected = process.env.EXOTEL_KEY;
  if (expected && params.key !== expected) return new Response("Unauthorized", { status: 401 });
  delete params.key;

  const callSid = params.CallSid;
  const callFrom = params.CallFrom ?? params.From;
  if (!callSid || !callFrom) return new Response("Missing CallSid/CallFrom", { status: 400 });

  const fields = {
    callFrom,
    phone: normalizePhone(callFrom),
    callTo: params.CallTo ?? params.To ?? null,
    direction: params.Direction ?? null,
    callType: params.CallType ?? null,
    startTime: params.StartTime ?? params.Created ?? null,
    raw: params,
  };

  try {
    // Passthru may fire more than once per call (e.g. retries, several applets); keep one row.
    await prisma.call.upsert({ where: { callSid }, create: { callSid, ...fields }, update: fields });
  } catch (err) {
    console.error("Failed to save Exotel call", callSid, err);
  }

  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}

export const GET = handle;
export const POST = handle;
