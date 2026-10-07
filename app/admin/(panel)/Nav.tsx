"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Leads" },
  { href: "/admin/calls", label: "Calls" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            path === l.href ? "bg-white/15 text-white" : "text-white/75 hover:text-white"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
