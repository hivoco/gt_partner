"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDIAN_STATES } from "@/lib/states";
import { validateLead, type FieldErrors, type LeadInput } from "@/lib/lead";

type Props = { defaults: { phone: string; name: string }; source: string };

const inputCls =
  "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-red-500";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export default function LeadForm({ defaults, source }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof LeadInput, string>>({
    name: defaults.name,
    phone: defaults.phone.replace(/\D/g, "").slice(-10),
    state: "",
    city: "",
    storeName: "",
    existingRetailer: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof LeadInput) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const check = validateLead(values);
    if (check.errors) return setErrors(check.errors);

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, source }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) return router.push(`/thank-you?name=${encodeURIComponent(values.name.split(" ")[0])}`);
      if (json.errors) setErrors(json.errors);
      else setFormError(json.error ?? "Something went wrong. Please try again.");
    } catch {
      setFormError("Network error. Check your connection and try again.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Full Name" error={errors.name}>
        <input
          className={inputCls}
          value={values.name}
          onChange={set("name")}
          autoComplete="name"
          placeholder="e.g. Ramesh Kumar"
          aria-invalid={!!errors.name}
        />
      </Field>

      <Field label="Contact Number" error={errors.phone}>
        <div className="flex">
          <span className="mt-1.5 flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-slate-500">
            +91
          </span>
          <input
            className={`${inputCls} rounded-l-none`}
            value={values.phone}
            onChange={set("phone")}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="10-digit mobile number"
            aria-invalid={!!errors.phone}
          />
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="State" error={errors.state}>
          <select
            className={`${inputCls} ${values.state ? "" : "text-slate-400"}`}
            value={values.state}
            onChange={set("state")}
            aria-invalid={!!errors.state}
          >
            <option value="" disabled>
              Select state
            </option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s} className="text-slate-900">
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="City" error={errors.city}>
          <input
            className={inputCls}
            value={values.city}
            onChange={set("city")}
            autoComplete="address-level2"
            placeholder="Your city"
            aria-invalid={!!errors.city}
          />
        </Field>
      </div>

      <Field label="Store Name" error={errors.storeName}>
        <input
          className={inputCls}
          value={values.storeName}
          onChange={set("storeName")}
          autoComplete="organization"
          placeholder="Name of your store"
          aria-invalid={!!errors.storeName}
        />
      </Field>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Are you an existing retailer?</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-3">
          {(["Yes", "No"] as const).map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 py-3 font-medium transition has-checked:border-brand has-checked:bg-brand has-checked:text-white"
            >
              <input
                type="radio"
                name="existingRetailer"
                value={opt}
                checked={values.existingRetailer === opt}
                onChange={set("existingRetailer")}
                className="sr-only"
              />
              {opt}
            </label>
          ))}
        </div>
        {errors.existingRetailer && (
          <span className="mt-1 block text-xs text-red-600">{errors.existingRetailer}</span>
        )}
      </fieldset>

      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand py-3.5 text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Register Interest"}
      </button>
    </form>
  );
}
