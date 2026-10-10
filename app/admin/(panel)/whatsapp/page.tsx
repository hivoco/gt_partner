import { prisma } from "@/lib/prisma";
import { formatIST, leadWhere, page as pageOf, PAGE_SIZE, type Params } from "@/lib/admin-filters";
import { Badge, fieldCls, Pagination, Stat, Table, Toolbar } from "../ui";

export const dynamic = "force-dynamic";

const SOURCE = "whatsapp_flow";

// "screen_0_Store_Name_3" → "Store Name"
const label = (key: string) => key.replace(/^screen_\d+_/i, "").replace(/_\d+$/, "").replace(/_/g, " ");
const show = (v: unknown) =>
  (Array.isArray(v) ? v.join(", ") : String(v ?? "")).replace(/(^|, )\d+_/g, "$1").replace(/_/g, " ");

function minutesBetween(from: Date, to: Date) {
  const mins = Math.round((to.getTime() - from.getTime()) / 60000);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default async function WhatsAppLeadsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params: Params = { ...(await searchParams), source: SOURCE };
  const where = leadWhere(params);
  const page = pageOf(params);

  const [leads, total, uniqueLeads, templatesSent, failed, states] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { source: SOURCE, duplicate: false } }),
    // Numbers the form reached: accepted by Interakt, whatever the delivery status is now (failed excluded).
    prisma.call.groupBy({ by: ["phone"], where: { waStatus: { in: ["sent", "delivered", "read"] } } }).then((r) => r.length),
    prisma.webhookEvent.count({ where: { provider: "interakt", status: { in: ["invalid", "error"] } } }),
    prisma.lead
      .groupBy({ by: ["state"], where: { source: SOURCE }, orderBy: { state: "asc" } })
      .then((r) => r.map((s) => s.state)),
  ]);

  const callSids = leads.map((l) => l.callSid).filter((s): s is string => !!s);
  const calls = new Map(
    (await prisma.call.findMany({ where: { callSid: { in: callSids } }, select: { callSid: true, createdAt: true } })).map(
      (c) => [c.callSid, c.createdAt]
    )
  );
  // Capped: leads from numbers we never sent to (e.g. a manual Interakt broadcast) shouldn't push this past 100%.
  const completion = templatesSent ? `${Math.min(100, (uniqueLeads / templatesSent) * 100).toFixed(1)}%` : "–";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="WhatsApp leads" value={uniqueLeads} hint="unique numbers" />
        <Stat label="Form sent to" value={templatesSent} hint="unique numbers" />
        <Stat label="Form completion" value={completion} hint="leads / form sent" />
        <Stat
          label="Failed submissions"
          value={failed}
          hint={failed ? "submitted but missing a field" : "all submissions saved"}
        />
      </div>

      <Toolbar base="/admin/whatsapp" exportType="leads" params={params} total={total}>
        <label className="flex min-w-48 flex-1 flex-col text-xs font-medium text-slate-600">
          Search
          <input name="q" defaultValue={params.q} placeholder="Name, phone, store, city" className={`${fieldCls} mt-1`} />
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          State
          <select name="state" defaultValue={params.state ?? ""} className={`${fieldCls} mt-1`}>
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Existing retailer
          <select name="retailer" defaultValue={params.retailer ?? ""} className={`${fieldCls} mt-1`}>
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Repeats
          <select name="dup" defaultValue={params.dup ?? ""} className={`${fieldCls} mt-1`}>
            <option value="">Show all</option>
            <option value="hide">Hide repeats</option>
            <option value="only">Only repeats</option>
          </select>
        </label>
      </Toolbar>

      <Table
        empty={!leads.length}
        head={["Submitted", "Name", "Mobile", "State", "City", "Store", "Existing retailer", "Consent", "Missed call", "Form answers", ""]}
      >
        {leads.map((l) => {
          const callAt = l.callSid ? calls.get(l.callSid) : undefined;
          const answers = Object.entries((l.answers as Record<string, unknown> | null) ?? {}).filter(([k]) => k !== "flow_token");
          return (
            <tr key={l.id} className="align-top hover:bg-slate-50">
              <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatIST(l.createdAt)}</td>
              <td className="px-4 py-3 font-medium">{l.name}</td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">{l.phone}</td>
              <td className="px-4 py-3">{l.state}</td>
              <td className="px-4 py-3">{l.city}</td>
              <td className="px-4 py-3">{l.storeName}</td>
              <td className="px-4 py-3">
                <Badge tone={l.existingRetailer ? "green" : "slate"}>{l.existingRetailer ? "Yes" : "No"}</Badge>
              </td>
              <td className="px-4 py-3">{l.consent ? "Yes" : "No"}</td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                {callAt ? (
                  <>
                    {formatIST(callAt)}
                    <span className="block text-xs">form filled in {minutesBetween(callAt, l.createdAt)}</span>
                  </>
                ) : (
                  "–"
                )}
              </td>
              <td className="px-4 py-3">
                {answers.length ? (
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-brand">View ({answers.length})</summary>
                    <dl className="mt-2 space-y-1 text-xs">
                      {answers.map(([k, v]) => (
                        <div key={k}>
                          <dt className="inline text-slate-500">{label(k)}: </dt>
                          <dd className="inline">{show(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : (
                  "–"
                )}
              </td>
              <td className="px-4 py-3">{l.duplicate && <Badge tone="amber">Repeat</Badge>}</td>
            </tr>
          );
        })}
      </Table>

      <Pagination base="/admin/whatsapp" params={params} page={page} total={total} />
    </div>
  );
}
