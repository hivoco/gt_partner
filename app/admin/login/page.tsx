import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Admin login · GT Partner", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/admin" } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-lg shadow-black/5">
        <p className="text-xs font-semibold tracking-widest text-brand uppercase">GT Partner Program</p>
        <h1 className="mt-1 mb-6 text-xl font-bold">Admin sign in</h1>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
