import PluginDetailClientPage from "./PluginDetailClient";

export async function generateStaticParams() {
  const base = process.env.ADMIN_INTERNAL_API_BASE_URL?.replace(/\/$/, "") || "";
  const url = `${base || ""}/admin/api/plugins/`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const json: any = await res.json().catch(() => null);
    const list = json?.data;

    if (res.ok && Array.isArray(list)) {
      return list
        .map((p: any) => (p && p.name ? { name: String(p.name) } : null))
        .filter(Boolean) as Array<{ name: string }>;
    }
  } catch {
    // ignore
  }

  const fallback = (process.env.NEXT_PUBLIC_STATIC_PLUGIN_NAMES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fallback.map((name) => ({ name }));
}

export default function PluginDetailPage() {
  return <PluginDetailClientPage />;
}
