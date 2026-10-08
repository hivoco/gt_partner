import { prisma } from "@/lib/prisma";
import { callWhere, formatIST, page as pageOf, PAGE_SIZE, type Params } from "@/lib/admin-filters";
import { Badge, fieldCls, Pagination, Stat, Table, Toolbar } from "../ui";

export const dynamic = "force-dynamic";

const WA_TONE: Record<string, "green" | "slate" | "amber" | "red"> = {
  read: "green",
  delivered: "green",
  sent: "slate",
  pending: "slate",
  skipped: "amber",
  failed: "red",
};

const time = (d: Date) =>
  d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

export default async function CallsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const where = callWhere(params);
  const page = pageOf(params);
  const todayIST = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T00:00:00+05:30`);

  const [calls, total, allCalls, today, uniqueCallers, waCounts] = await Promise.all([
    prisma.call.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.call.count({ where }),
    prisma.call.count(),
    prisma.call.count({ where: { createdAt: { gte: todayIST } } }),
    prisma.call.groupBy({ by: ["phone"], where: { phone: { not: null } } }).then((r) => r.length),
    prisma.call.groupBy({ by: ["waStatus"], _count: true }),
  ]);
  const wa = (s: string) => waCounts.find((c) => c.waStatus === s)?._count ?? 0;
  const delivered = wa("delivered") + wa("read");
  const attempted = wa("sent") + delivered + wa("failed");

  const phones = calls.map((c) => c.phone).filter((p): p is string => !!p);
  const registered = new Set(
    (await prisma.lead.findMany({ where: { phone: { in: phones } }, select: { phone: true }, distinct: ["phone"] })).map((l) => l.phone)
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total calls" value={allCalls} hint={`${today.toLocaleString("en-IN")} today (IST)`} />
        <Stat label="Unique callers" value={uniqueCallers} />
        <Stat
          label="WhatsApp delivered"
          value={delivered}
          hint={`of ${attempted.toLocaleString("en-IN")} sent · ${wa("read").toLocaleString("en-IN")} read`}
        />
        <Stat
          label="WhatsApp failed"
          value={wa("failed")}
          hint={`${wa("skipped").toLocaleString("en-IN")} skipped as repeat callers`}
        />
      </div>

      <Toolbar base="/admin/calls" exportType="calls" params={params} total={total}>
        <label className="flex min-w-48 flex-1 flex-col text-xs font-medium text-slate-600">
          Search
          <input name="q" defaultValue={params.q} placeholder="Caller number" inputMode="numeric" className={`${fieldCls} mt-1`} />
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          WhatsApp status
          <select name="wa" defaultValue={params.wa ?? ""} className={`${fieldCls} mt-1`}>
            <option value="">All</option>
            <option value="read">Read</option>
            <option value="delivered">Delivered</option>
            <option value="sent">Sent (not delivered yet)</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="none">Not sent</option>
          </select>
        </label>
      </Toolbar>

      <Table empty={!calls.length} head={["Received", "Caller", "ExoPhone", "Call type", "WhatsApp", "Details", "Registered"]}>
        {calls.map((c) => (
          <tr key={c.id} className="align-top hover:bg-slate-50">
            <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatIST(c.createdAt)}</td>
            <td className="px-4 py-3 font-medium whitespace-nowrap tabular-nums">{c.phone ?? c.callFrom}</td>
            <td className="px-4 py-3 tabular-nums">{c.callTo}</td>
            <td className="px-4 py-3">{c.callType}</td>
            <td className="px-4 py-3">
              {c.waStatus ? (
                <Badge tone={WA_TONE[c.waStatus] ?? "slate"}>{c.waStatus}</Badge>
              ) : (
                <span className="text-slate-400">{c.phone ? "–" : "not a mobile"}</span>
              )}
            </td>
            <td className="max-w-sm px-4 py-3 text-xs">
              {c.waError && <p className={c.waStatus === "failed" ? "text-red-700" : "text-slate-600"}>{c.waError}</p>}
              {(c.waSentAt || c.waDeliveredAt || c.waReadAt) && (
                <p className="text-slate-500">
                  {[c.waSentAt && `sent ${time(c.waSentAt)}`, c.waDeliveredAt && `delivered ${time(c.waDeliveredAt)}`, c.waReadAt && `read ${time(c.waReadAt)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <p className="mt-0.5 font-mono text-[11px] text-slate-400">{c.callSid}</p>
            </td>
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
