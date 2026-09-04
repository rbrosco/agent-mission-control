// Helper compartilhado para chamadas ao backend Mission Control (server.py),
// que agora exige HTTP Basic Auth (ver server.py _check_auth).
export const MC_API_BASE =
  process.env.NEXT_PUBLIC_MC_URL || "http://127.0.0.1:51763";

function authHeader(): Record<string, string> {
  const user = process.env.NEXT_PUBLIC_MC_USER || "admin";
  const pass = process.env.NEXT_PUBLIC_MC_PASS || "";
  if (!pass) return {};
  const token =
    typeof window === "undefined"
      ? Buffer.from(`${user}:${pass}`).toString("base64")
      : btoa(`${user}:${pass}`);
  return { Authorization: `Basic ${token}` };
}

export async function mcFetchJSON(path: string, init?: RequestInit) {
  const url = path.startsWith("http") ? path : `${MC_API_BASE}${path}`;
  const resp = await fetch(url, {
    ...init,
    headers: { ...authHeader(), ...(init?.headers || {}) },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || `HTTP ${resp.status}`);
    // @ts-ignore
    err.status = resp.status;
    throw err;
  }
  return data;
}
