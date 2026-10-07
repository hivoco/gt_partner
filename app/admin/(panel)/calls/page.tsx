import { prisma } from "@/lib/prisma";
import { callWhere, formatIST, page as pageOf, PAGE_SIZE, type Params } from "@/lib/admin-filters";
import { Badge, fieldCls, Pagination, Stat, Table, Toolbar } from "../ui";

export const dynamic = "force-dynamic";

export default async function CallsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const where = callWhere(params);
  const page = pageOf(params);
  const todayIST = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T00:00:00+05:30`);

  const [calls, total, allCalls, today, uniqueCallers] = await Promise.all([
    prisma.call.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.call.count({ where }),
    prisma.call.count(),
    prisma.call.count({ where: { createdAt: { gte: todayIST } } }),
    prisma.call.groupBy({ by: ["phone"], where: { phone: { not: null } } }).then((r) => r.length),
  ]);

  const phones = calls.map((c) => c.phone).filter((p): p is string => !!p);
  const registered = new Set(
    (await prisma.lead.findMany({ where: { phone: { in: phones } }, select: { phone: true }, distinct: ["phone"] })).map((l) => l.phone)
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total calls" value={allCalls} />
        <Stat label="Unique callers" value={uniqueCallers} />
        <Stat label="Calls today" value={today} hint="IST" />
      </div>

      <Toolbar base="/admin/calls" exportType="calls" params={params} total={total}>
        <label className="flex min-w-48 flex-1 flex-col text-xs font-medium text-slate-600">
          Search
          <input name="q" defaultValue={params.q} placeholder="Caller number" inputMode="numeric" className={`${fieldCls} mt-1`} />
        </label>
      </Toolbar>

      <Table empty={!calls.length} head={["Received", "Caller", "ExoPhone", "Direction", "Call type", "Call SID", "Registered"]}>
        {calls.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatIST(c.createdAt)}</td>
            <td className="px-4 py-3 font-medium whitespace-nowrap tabular-nums">{c.phone ?? c.callFrom}</td>
            <td className="px-4 py-3 tabular-nums">{c.callTo}</td>
            <td className="px-4 py-3">{c.direction}</td>
            <td className="px-4 py-3">{c.callType}</td>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.callSid}</td>
            <td className="px-4 py-3">
              {c.phone && registered.has(c.phone) ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">Not yet</Badge>}
            </td>
          </tr>
        ))}
      </Table>

      <Pagination base="/admin/calls" params={params} page={page} total={total} />
    </div>
  );
}
