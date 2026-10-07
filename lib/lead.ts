export type LeadInput = {
  name: string;
  phone: string;
  state: string;
  city: string;
  storeName: string;
  existingRetailer: "Yes" | "No";
};

export type FieldErrors = Partial<Record<keyof LeadInput, string>>;

// Accepts 10-digit Indian mobiles with optional +91 / 91 / 0 prefix and spaces or dashes.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length > 10 ? digits.replace(/^(91|0)/, "") : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export function validateLead(body: Record<string, unknown>): {
  data?: LeadInput;
  errors?: FieldErrors;
} {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name ?? body.full_name);
  const phone = normalizePhone(str(body.phone));
  const state = str(body.state);
  const city = str(body.city);
  const storeName = str(body.storeName ?? body.store_name);
  const retailer = str(body.existingRetailer ?? body.existing_retailer).toLowerCase();
  const existingRetailer = retailer === "yes" ? "Yes" : retailer === "no" ? "No" : "";

  const errors: FieldErrors = {};
  if (name.length < 2) errors.name = "Please enter your full name";
  if (!phone) errors.phone = "Enter a valid 10-digit mobile number";
  if (state.length < 2 || state.length > 60) errors.state = "Select your state";
  if (city.length < 2) errors.city = "Enter your city";
  if (storeName.length < 2) errors.storeName = "Enter your store name";
  if (existingRetailer !== "Yes" && existingRetailer !== "No")
    errors.existingRetailer = "Select Yes or No";

  if (Object.keys(errors).length) return { errors };
  return {
    data: {
      name,
      phone: phone!,
      state,
      city,
      storeName,
      existingRetailer: existingRetailer as "Yes" | "No",
    },
  };
}
