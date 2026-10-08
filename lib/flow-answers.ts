// Turns WhatsApp Flow answers into lead fields, whatever the Flow named them.
// Handles hand-written names (full_name, store_name) and Flow Builder names (screen_0_Store_name_3),
// plus Flow Builder option ids like "0_Maharashtra" or "1_Yes".

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "yourname", "ownername", "retailername", "partnername"],
  state: ["state", "selectstate", "yourstate"],
  city: ["city", "town", "citytown", "yourcity"],
  storeName: ["storename", "store", "shopname", "shop", "outletname", "businessname", "firmname"],
  existingRetailer: ["existingretailer", "retailer", "areyouanexistingretailer", "areyouaretailer", "existing"],
  consent: ["consent", "optin", "agree", "iagree", "terms"],
};

const normKey = (k: string) =>
  k
    .replace(/^screen_\d+_/i, "")
    .replace(/_\d+$/, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

// Checkbox/radio answers can arrive as lists (["0_yes"]); take the first choice.
const cleanValue = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.length ? cleanValue(v[0]) : "";
  return typeof v === "string" ? v.replace(/^\d+_/, "").replace(/_/g, " ").trim() : v;
};

function fieldFor(key: string): string | null {
  const k = normKey(key);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) if (aliases.includes(k)) return field;
  return null;
}

export function mapFlowAnswers(answers: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    const field = fieldFor(key);
    if (field && out[field] === undefined) out[field] = cleanValue(value);
  }
  if (typeof out.existingRetailer === "string") {
    const v = out.existingRetailer.toLowerCase();
    out.existingRetailer = v.startsWith("y") ? "Yes" : v.startsWith("n") ? "No" : out.existingRetailer;
  }
  const consent = typeof out.consent === "string" ? out.consent.toLowerCase() : out.consent;
  out.consent = consent === true || consent === "true" || consent === "yes" || consent === "agree";
  return out;
}

// Looks through a webhook payload for the object holding the Flow answers.
export function findFlowAnswers(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || node == null) return null;
  if (typeof node === "string") {
    const t = node.trim();
    if (!t.startsWith("{")) return null;
    try {
      return findFlowAnswers(JSON.parse(t), depth + 1);
    } catch {
      return null;
    }
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFlowAnswers(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if ("response_json" in obj) {
      const found = findFlowAnswers(obj.response_json, depth + 1);
      if (found) return found;
    }
    const matched = new Set(Object.keys(obj).map(fieldFor).filter(Boolean));
    if (matched.size >= 2 && (matched.has("name") || matched.has("storeName"))) return obj;
    for (const v of Object.values(obj)) {
      const found = findFlowAnswers(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
