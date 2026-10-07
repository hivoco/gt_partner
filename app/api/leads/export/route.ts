import { prisma } from "@/lib/prisma";

const LEAD_COLUMNS = [
  ["createdAt", "Submitted At"],
  ["name", "Name"],
  ["phone", "Contact Number"],
  ["state", "State"],
  ["city", "City"],
  ["storeName", "Store Name"],
  ["existingRetailer", "Existing Retailer"],
  ["consent", "Consent"],
  ["duplicate", "Duplicate"],
  ["source", "Source"],
  ["callSid", "Call SID"],
] as const;

const CALL_COLUMNS = [
  ["createdAt", "Received At"],
  ["callSid", "Call SID"],
  ["callFrom", "Call From"],
  ["phone", "Mobile"],
  ["callTo", "Call To"],
  ["direction", "Direction"],
  ["callType", "Call Type"],
  ["startTime", "Start Time"],
] as const;

const csvCell = (v: unknown) => {
  const text = v instanceof Date ? v.toISOString() : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const key = params.get("key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ?type=calls downloads the Exotel call log instead of leads.
  const type = params.get("type") === "calls" ? "calls" : "leads";
  const columns: readonly (readonly [string, string])[] = type === "calls" ? CALL_COLUMNS : LEAD_COLUMNS;
  const records: Record<string, unknown>[] =
    type === "calls"
      ? await prisma.call.findMany({ orderBy: { createdAt: "asc" } })
      : await prisma.lead.findMany({ orderBy: { createdAt: "asc" } });

  const rows = [
    columns.map(([, label]) => csvCell(label)).join(","),
    ...records.map((r) => columns.map(([k]) => csvCell(r[k])).join(",")),
  ];

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gt-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
