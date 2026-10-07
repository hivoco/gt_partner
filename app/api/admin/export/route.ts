import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { callWhere, leadWhere, type Params } from "@/lib/admin-filters";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// Excel has no time zones, so write IST wall-clock time.
const ist = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS);

function sheet(wb: ExcelJS.Workbook, name: string, columns: Partial<ExcelJS.Column>[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns;
  ws.addRows(rows);
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C81" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

// Admin-only (proxy.ts). Applies the same filters as the admin tables.
export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams) as Params;
  const type = params.type === "calls" ? "calls" : "leads";
  const wb = new ExcelJS.Workbook();
  wb.creator = "GT Partner Admin";
  const dateFmt = "dd-mmm-yyyy hh:mm";

  if (type === "leads") {
    const leads = await prisma.lead.findMany({ where: leadWhere(params), orderBy: { createdAt: "desc" } });
    sheet(
      wb,
      "Leads",
      [
        { header: "Submitted At (IST)", key: "createdAt", width: 20, style: { numFmt: dateFmt } },
        { header: "Name", key: "name", width: 24 },
        { header: "Mobile", key: "phone", width: 14 },
        { header: "State", key: "state", width: 18 },
        { header: "City", key: "city", width: 16 },
        { header: "Store Name", key: "storeName", width: 28 },
        { header: "Existing Retailer", key: "existingRetailer", width: 16 },
        { header: "Consent", key: "consent", width: 10 },
        { header: "Repeat", key: "duplicate", width: 10 },
        { header: "Source", key: "source", width: 14 },
        { header: "Call SID", key: "callSid", width: 36 },
      ],
      leads.map((l) => ({
        ...l,
        createdAt: ist(l.createdAt),
        existingRetailer: l.existingRetailer ? "Yes" : "No",
        consent: l.consent ? "Yes" : "No",
        duplicate: l.duplicate ? "Yes" : "No",
      }))
    );
  } else {
    const calls = await prisma.call.findMany({ where: callWhere(params), orderBy: { createdAt: "desc" } });
    const registered = new Set(
      (await prisma.lead.findMany({ select: { phone: true }, distinct: ["phone"] })).map((l) => l.phone)
    );
    sheet(
      wb,
      "Calls",
      [
        { header: "Received At (IST)", key: "createdAt", width: 20, style: { numFmt: dateFmt } },
        { header: "Caller (raw)", key: "callFrom", width: 15 },
        { header: "Mobile", key: "phone", width: 14 },
        { header: "ExoPhone", key: "callTo", width: 15 },
        { header: "Direction", key: "direction", width: 11 },
        { header: "Call Type", key: "callType", width: 14 },
        { header: "Exotel Start Time", key: "startTime", width: 20 },
        { header: "Call SID", key: "callSid", width: 36 },
        { header: "Registered", key: "registered", width: 11 },
      ],
      calls.map((c) => ({
        ...c,
        createdAt: ist(c.createdAt),
        registered: c.phone && registered.has(c.phone) ? "Yes" : "No",
      }))
    );
  }

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="gt-${type}-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
