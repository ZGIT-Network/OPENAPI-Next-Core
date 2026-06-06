"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { requireAdminSession } from "@/lib/adminAuth";
import { adminApi } from "@/lib/api";

type ResourceInfo = {
  id: string;
  title?: string;
  permissions?: string[];
  primaryKey?: string;
  table?: string;
  fields?: Record<string, any>;
};

type PluginResources = {
  plugin: string;
  title?: string;
  resources: ResourceInfo[];
};

export default function DataHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PluginResources[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ok = await requireAdminSession(() => router.replace("/login"));
      if (!ok || cancelled) return;

      try {
        setLoading(true);
        const data = await adminApi.getDataResources();
        if (!cancelled) {
          setItems(data.data || []);
        }
      } catch (e) {
        router.replace("/login");
        toast.error(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const flat = useMemo(() => {
    const out: Array<{ plugin: string; pluginTitle: string; resource: ResourceInfo }> = [];
    for (const p of items) {
      for (const r of p.resources || []) {
        out.push({ plugin: p.plugin, pluginTitle: p.title || p.plugin, resource: r });
      }
    }
    return out;
  }, [items]);

  return (
    <AdminShell title="数据">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">数据管理</h1>
        <p className="text-sm text-muted-foreground">
          列出所有插件声明的可管理资源（admin.resources）。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : flat.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          暂无可管理资源，请在插件 `manifest.json` 中声明 `admin.resources`。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {flat.map((x) => (
            <Card key={`${x.plugin}:${x.resource.id}`}>
              <CardHeader>
                <CardTitle>{x.resource.title || x.resource.id}</CardTitle>
                <CardDescription>
                  {x.pluginTitle} / {x.plugin}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {x.resource.table ? `table: ${x.resource.table}` : null}
                </div>
                <Button
                  onClick={() => router.push(`/data/${encodeURIComponent(x.plugin)}/${encodeURIComponent(x.resource.id)}`)}
                >
                  打开
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
