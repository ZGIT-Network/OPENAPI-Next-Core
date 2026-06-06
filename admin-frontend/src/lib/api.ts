const API_BASE_URL = "/admin/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");

  if (!response.ok) {
    let errorData: any = null;
    try {
      errorData = isJson ? await response.json() : await response.text();
    } catch {
      errorData = null;
    }

    const msg =
      (errorData && typeof errorData === "object" && errorData.error) ||
      (typeof errorData === "string" && errorData) ||
      `HTTP ${response.status}`;

    throw new Error(msg);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (isJson ? response.json() : response.text()) as Promise<T>;
}

export const adminApi = {
  login: (key: string): Promise<{ ok: boolean; token: string; ttlSeconds: number }> => {
    return request("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key }),
    });
  },

  getPluginManifests: (): Promise<{ ok: boolean; data: any[] }> => {
    return request("/plugins/manifests", { method: "GET" });
  },

  getDataResources: (): Promise<{ ok: boolean; data: any[] }> => {
    return request("/data/resources", { method: "GET" });
  },

  getMetricsOverview: (windowSeconds: number): Promise<{ ok: boolean; data: any }> => {
    return request(`/metrics/overview?window=${windowSeconds}`, { method: "GET" });
  },

  getAdminCards: (params: { placement?: string; plugin?: string } = {}): Promise<{ ok: boolean; data: any[] }> => {
    const q = new URLSearchParams();
    if (params.placement) q.set("placement", params.placement);
    if (params.plugin) q.set("plugin", params.plugin);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request(`/cards${suffix}`, { method: "GET" });
  },

  listPlugins: (): Promise<{ ok: boolean; data: any[] }> => {
    return request("/plugins/", { method: "GET" });
  },

  getPluginDetail: (name: string): Promise<{ ok: boolean; data: any }> => {
    return request(`/plugins/${encodeURIComponent(name)}`, { method: "GET" });
  },

  getPluginReadme: (name: string): Promise<{ ok: boolean; data: { content: string } }> => {
    return request(`/plugins/${encodeURIComponent(name)}/readme`, { method: "GET" });
  },

  enablePlugin: (name: string): Promise<{ ok: boolean }> => {
    return request(`/plugins/${encodeURIComponent(name)}/enable`, { method: "POST" });
  },

  disablePlugin: (name: string): Promise<{ ok: boolean }> => {
    return request(`/plugins/${encodeURIComponent(name)}/disable`, { method: "POST" });
  },

  disablePhysical: (name: string): Promise<{ ok: boolean; already?: boolean }> => {
    return request(`/plugins/${encodeURIComponent(name)}/disable-physical`, { method: "POST" });
  },

  enablePhysical: (name: string): Promise<{ ok: boolean }> => {
    return request(`/plugins/${encodeURIComponent(name)}/enable-physical`, { method: "POST" });
  },

  checkHealth: (name: string): Promise<{ ok: boolean; data: any }> => {
    return request(`/plugins/${encodeURIComponent(name)}/health`, { method: "POST" });
  },

  uninstallPlugin: (name: string): Promise<{ ok: boolean }> => {
    return request(`/plugins/${encodeURIComponent(name)}/uninstall`, { method: "POST" });
  },

  refreshPlugins: (): Promise<{ ok: boolean }> => {
    return request("/plugins/refresh", { method: "POST" });
  },

  getSession: (): Promise<{ ok: boolean; authenticated: boolean; ttlSeconds: number; actor: string }> => {
    return request("/auth/session", { method: "GET" });
  },

  logout: (): Promise<{ ok: boolean }> => {
    return request("/auth/logout", { method: "POST" });
  },

  installZip: async (file: File, pluginName?: string, update?: boolean): Promise<{ ok: boolean; plugin?: string; updated?: boolean }> => {
    const form = new FormData();
    form.append("file", file);
    if (pluginName) form.append("pluginName", pluginName);
    if (update) form.append("update", "true");

    const res = await fetch(`${API_BASE_URL}/plugins/install/upload-zip`, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    }
    return data;
  },

  installFromUrl: (url: string, pluginName?: string, update?: boolean): Promise<{ ok: boolean; plugin?: string; updated?: boolean }> => {
    return request("/plugins/install/from-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, pluginName, update }),
    });
  },
};
