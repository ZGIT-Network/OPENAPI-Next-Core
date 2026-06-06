"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { adminApi } from "@/lib/api";
import { requireAdminSession } from "@/lib/adminAuth";

import { AdminShell } from "@/components/admin/AdminShell";
import { ManifestVisual, type Manifest } from "@/components/admin/ManifestVisual";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ManifestItem = {
  manifest: Manifest;
  source?: {
    path?: string;
    content?: string;
  } | null;
};

function normalizeManifestItem(item: Manifest | ManifestItem): ManifestItem {
  if (item && typeof item === "object" && "manifest" in item) {
    return item as ManifestItem;
  }
  return { manifest: item as Manifest, source: null };
}

function getText(m: Manifest) {
  const parts: string[] = [];
  if (m.name) parts.push(String(m.name));
  if (m.title) parts.push(String(m.title));
  if (m.type) parts.push(String(m.type));
  if (m.author) parts.push(String(m.author));
  if (m.version) parts.push(String(m.version));
  if (m.nav?.group) parts.push(String(m.nav.group));
  if (m.nav?.path) parts.push(String(m.nav.path));
  if (m.ui?.description) parts.push(String(m.ui.description));
  return parts.join(" ").toLowerCase();
}

export default function ManifestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ManifestItem[]>([]);

  const load = async () => {
    const ok = await requireAdminSession(() => router.replace("/login"));
    if (!ok) return;

    setLoading(true);
    try {
      const res = await adminApi.getPluginManifests();
      setItems((res.data || []).map(normalizeManifestItem));
    } catch (e) {
      router.replace("/login");
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => getText(item.manifest).includes(q));
  }, [items, query]);

  return (
    <AdminShell title="Manifests">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Manifests</h1>
        <p className="text-sm text-muted-foreground">
          查看插件 manifest 的可视化解析结果、JSON 和源文件。
        </p>
      </div>

      <div className="mb-4 space-y-2">
        <Label htmlFor="search">搜索</Label>
        <Input
          id="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="按 name/title/type/nav.group/nav.path 搜索"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">无匹配项</p>
      ) : (
        <Accordion type="multiple" className="w-full">
          {filtered.map((item, idx) => {
            const m = item.manifest;
            const name = m.name || `manifest-${idx}`;
            const title = m.title || name;
            const type = m.type;
            const navGroup = m.nav?.group;
            const sourcePath = item.source?.path || "";
            const sourceContent = item.source?.content || "";

            return (
              <AccordionItem key={String(name) + idx} value={String(name) + idx}>
                <AccordionTrigger>
                  <div className="flex w-full items-center justify-between pr-4">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{String(title)}</div>
                      {type ? <Badge variant="secondary">{String(type)}</Badge> : null}
                      {navGroup ? <Badge>{String(navGroup)}</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.nav?.path ? String(m.nav.path) : ""}</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Tabs defaultValue="visual">
                    <TabsList className="mb-3">
                      <TabsTrigger value="visual">可视化</TabsTrigger>
                      <TabsTrigger value="json">JSON</TabsTrigger>
                      <TabsTrigger value="source">源文件</TabsTrigger>
                    </TabsList>
                    <TabsContent value="visual">
                      <ManifestVisual manifest={m} />
                    </TabsContent>
                    <TabsContent value="json">
                      <ScrollArea className="h-72 rounded-md border bg-muted p-3">
                        <pre className="text-xs">{JSON.stringify(m, null, 2)}</pre>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="source">
                      {sourceContent ? (
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">{sourcePath}</div>
                          <ScrollArea className="h-72 rounded-md border bg-muted p-3">
                            <pre className="text-xs">{sourceContent}</pre>
                          </ScrollArea>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">未找到源文件</p>
                      )}
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </AdminShell>
  );
}
