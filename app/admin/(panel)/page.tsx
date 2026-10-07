import { prisma } from "@/lib/prisma";
import { formatIST, leadWhere, page as pageOf, PAGE_SIZE, type Params } from "@/lib/admin-filters";
import { Badge, fieldCls, Pagination, Stat, Table, Toolbar } from "./ui";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const where = leadWhere(params);
  const page = pageOf(params);

  const [leads, total, allLeads, uniqueLeads, existing, uniqueCallers, states] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.lead.count({ where }),
    prisma.lead.count(),
    prisma.lead.count({ where: { duplicate: false } }),
    prisma.lead.count({ where: { duplicate: false, existingRetailer: true } }),
    prisma.call.groupBy({ by: ["phone"], where: { phone: { not: null } } }).then((r) => r.length),
    prisma.lead.groupBy({ by: ["state"], orderBy: { state: "asc" } }).then((r) => r.map((s) => s.state)),
  ]);

  const conversion = uniqueCallers ? `${((uniqueLeads / uniqueCallers) * 100).toFixed(1)}%` : "–";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Unique callers" value={uniqueCallers} hint="from Exotel" />
        <Stat label="Registered partners" value={uniqueLeads} hint={`${allLeads.toLocaleString("en-IN")} submissions incl. repeats`} />
        <Stat label="Call → lead" value={conversion} hint="registered / unique callers" />
        <Stat label="Existing retailers" value={existing} hint={`${(uniqueLeads - existing).toLocaleString("en-IN")} new to retail`} />
      </div>

      <Toolbar base="/admin" exportType="leads" params={params} total={total}>
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
        head={["Submitted", "Name", "Mobile", "State", "City", "Store", "Existing retailer", "Consent", "Source", ""]}
      >
        {leads.map((l) => (
          <tr key={l.id} className="hover:bg-slate-50">
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
            <td className="px-4 py-3 text-slate-500">{l.source}</td>
            <td className="px-4 py-3">{l.duplicate && <Badge tone="amber">Repeat</Badge>}</td>
          </tr>
        ))}
      </Table>

      <Pagination base="/admin" params={params} page={page} total={total} />
    </div>
  );
}
