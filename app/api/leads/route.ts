import { NextResponse } from "next/server";
import { validateLead } from "@/lib/lead";
import { saveLead } from "@/lib/save-lead";

// Web form (SMS fallback link) and any BSP that forwards Flow answers as plain JSON.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data, errors } = validateLead(body);
  if (!data) return NextResponse.json({ errors }, { status: 422 });

  try {
    const lead = await saveLead(data, {
      source: typeof body.source === "string" ? body.source : "web",
      consent: body.consent === true || body.consent === "true" || body.consent === undefined,
    });
    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (err) {
    console.error("Failed to save lead", err);
    return NextResponse.json({ error: "Could not save your details. Please try again." }, { status: 500 });
  }
}
