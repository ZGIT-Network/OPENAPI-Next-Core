import DataResourceClientPage from "./DataResourceClient";

type ResourcesIndexResponse = {
  ok: boolean;
  data: Array<{ plugin: string; resources: Array<{ id: string }> }>;
};

export async function generateStaticParams() {
  const base = process.env.ADMIN_INTERNAL_API_BASE_URL?.replace(/\/$/, "") || "";
  const url = `${base || ""}/admin/api/data/resources`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const json: ResourcesIndexResponse | any = await res.json().catch(() => null);
    const list = json?.data;

    if (res.ok && Array.isArray(list)) {
      const params: Array<{ plugin: string; resource: string }> = [];
      for (const p of list) {
        const plugin = p?.plugin ? String(p.plugin) : "";
        const resources = Array.isArray(p?.resources) ? p.resources : [];
        if (!plugin) continue;

        for (const r of resources) {
          const id = r?.id ? String(r.id) : "";
          if (!id) continue;
          params.push({ plugin, resource: id });
        }
      }
      return params;
    }
  } catch {
    // ignore
  }

  const fallback = (process.env.NEXT_PUBLIC_STATIC_DATA_RESOURCES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const params: Array<{ plugin: string; resource: string }> = [];
  for (const item of fallback) {
    const [plugin, resource] = item.split(":").map((x) => (x || "").trim());
    if (!plugin || !resource) continue;
    params.push({ plugin, resource });
  }
  return params;
}

export default function DataResourcePage() {
  return <DataResourceClientPage />;
}
