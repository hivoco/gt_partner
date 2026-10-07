import type { Metadata } from "next";
import Nav from "./Nav";

export const metadata: Metadata = { title: "Admin · GT Partner", robots: { index: false } };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <p className="font-bold">
            GT Partner <span className="font-normal text-white/70">Admin</span>
          </p>
          <Nav />
          <a href="/admin/logout" className="ml-auto text-sm text-white/80 hover:text-white">
            Log out
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
