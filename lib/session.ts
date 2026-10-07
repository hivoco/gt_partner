// Signed admin session cookie: "<expiry>.<hmac>". Uses Web Crypto so it also runs in proxy.ts.
// The signing key is derived from the admin credentials, so changing the password logs everyone out.

export const SESSION_COOKIE = "gt_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

const enc = new TextEncoder();

function secret() {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) return null;
  return `${user}:${pass}:${process.env.SESSION_SECRET ?? ""}`;
}

async function sign(value: string, key: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(value));
  return Buffer.from(sig).toString("base64url");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession() {
  const key = secret();
  if (!key) throw new Error("ADMIN_USERNAME / ADMIN_PASSWORD not set");
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  return `${exp}.${await sign(exp, key)}`;
}

export async function verifySession(token: string | undefined) {
  const key = secret();
  if (!token || !key) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await sign(exp, key));
}

export function checkCredentials(username: string, password: string) {
  const user = process.env.ADMIN_USERNAME ?? "";
  const pass = process.env.ADMIN_PASSWORD ?? "";
  // Evaluate both so timing doesn't reveal which one was wrong.
  const okUser = safeEqual(username, user);
  const okPass = safeEqual(password, pass);
  return !!user && !!pass && okUser && okPass;
}
