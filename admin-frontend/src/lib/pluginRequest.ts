export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function buildQueryString(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  return s.startsWith("?") ? s : `?${s}`;
}

export function normalizePath(raw: string) {
  const s = raw.trim();
  if (!s) return "/";
  return s.startsWith("/") ? s : `/${s}`;
}

export async function testPluginRequest(opts: {
  pluginName: string;
  method: HttpMethod;
  path: string;
  query: string;
  jsonBody?: string;
}) {
  const { pluginName, method } = opts;
  const path = normalizePath(opts.path);
  const qs = buildQueryString(opts.query);

  const url = `/${encodeURIComponent(pluginName)}${path}${qs}`;

  const init: RequestInit = {
    method,
    headers: {},
  };

  if (method !== "GET" && method !== "DELETE") {
    const body = (opts.jsonBody || "").trim();
    if (body) {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = body;
    }
  }

  const resp = await fetch(url, init);
  const contentType = resp.headers.get("content-type") || "";
  const text = await resp.text();

  let parsed: any = null;
  if (contentType.includes("application/json")) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    url,
    contentType,
    headers: Object.fromEntries(resp.headers.entries()),
    bodyText: text,
    bodyJson: parsed,
  };
}
