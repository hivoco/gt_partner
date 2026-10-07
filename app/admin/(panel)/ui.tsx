import Link from "next/link";
import { PAGE_SIZE, withParams, type Params } from "@/lib/admin-filters";

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export const fieldCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Toolbar({
  base,
  exportType,
  params,
  total,
  children,
}: {
  base: string;
  exportType: "leads" | "calls";
  params: Params;
  total: number;
  children: React.ReactNode;
}) {
  const exportParams = { ...params, page: undefined, type: exportType };
  return (
    <form method="get" action={base} className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {children}
      <label className="flex flex-col text-xs font-medium text-slate-600">
        From
        <input type="date" name="from" defaultValue={params.from} className={`${fieldCls} mt-1`} />
      </label>
      <label className="flex flex-col text-xs font-medium text-slate-600">
        To
        <input type="date" name="to" defaultValue={params.to} className={`${fieldCls} mt-1`} />
      </label>
      <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Apply</button>
      <Link href={base} className="px-2 py-2 text-sm text-slate-600 hover:text-slate-900">
        Reset
      </Link>
      <a
        href={withParams("/api/admin/export", exportParams)}
        className="ml-auto inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Download Excel ({total.toLocaleString("en-IN")})
      </a>
    </form>
  );
}

export function Pagination({ base, params, page, total }: { base: string; params: Params; page: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, total);
  const btn = "rounded-md px-3 py-1.5 ring-1 ring-slate-300 bg-white hover:bg-slate-50";
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
      <p>
        {start.toLocaleString("en-IN")}–{end.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 && <Link className={btn} href={withParams(base, params, { page: String(page - 1) })}>Previous</Link>}
        <span>
          Page {page} / {pages}
        </span>
        {page < pages && <Link className={btn} href={withParams(base, params, { page: String(page + 1) })}>Next</Link>}
      </div>
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-12 text-center text-slate-500">
                No records match these filters.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "slate" | "amber" }) {
  const tones = {
    green: "bg-green-50 text-green-700 ring-green-200",
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}>{children}</span>;
}
