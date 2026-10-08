import type { Prisma } from "@prisma/client";

export type Params = Record<string, string | undefined>;

export const PAGE_SIZE = 50;

// Date inputs are IST calendar days.
function dateRange(p: Params): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (p.from) range.gte = new Date(`${p.from}T00:00:00+05:30`);
  if (p.to) range.lte = new Date(`${p.to}T23:59:59.999+05:30`);
  return range.gte || range.lte ? range : undefined;
}

export function leadWhere(p: Params): Prisma.LeadWhereInput {
  const q = p.q?.trim();
  return {
    createdAt: dateRange(p),
    source: p.source || undefined,
    state: p.state || undefined,
    existingRetailer: p.retailer === "yes" ? true : p.retailer === "no" ? false : undefined,
    duplicate: p.dup === "hide" ? false : p.dup === "only" ? true : undefined,
    OR: q
      ? [
          { name: { contains: q } },
          { phone: { contains: q.replace(/\D/g, "").slice(-10) || q } },
          { storeName: { contains: q } },
          { city: { contains: q } },
        ]
      : undefined,
  };
}

export function callWhere(p: Params): Prisma.CallWhereInput {
  const digits = p.q?.replace(/\D/g, "").slice(-10);
  return {
    createdAt: dateRange(p),
    OR: digits ? [{ phone: { contains: digits } }, { callFrom: { contains: digits } }] : undefined,
  };
}

export function page(p: Params) {
  return Math.max(1, Number(p.page) || 1);
}

export function formatIST(d: Date) {
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function withParams(base: string, p: Params, overrides: Params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...p, ...overrides })) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}
