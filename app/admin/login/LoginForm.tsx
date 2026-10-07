"use client";

import { useActionState } from "react";
import { login } from "./actions";

const inputCls =
  "mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Username</span>
        <input name="username" autoComplete="username" required className={inputCls} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </label>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
