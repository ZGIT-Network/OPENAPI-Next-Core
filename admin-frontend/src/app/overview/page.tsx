"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminApi } from "@/lib/api";
import { requireAdminSession } from "@/lib/adminAuth";

import { AdminShell } from "@/components/admin/AdminShell";
import { AdminCards, type AdminCardConfig } from "@/components/admin/AdminCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Overview = {
  ok: boolean;
  windowSeconds: number;
  startedAt: number;
  now: number;
  global: {
    total: number;
    errors: number;
    errorRate: number;
    avgMs: number;
    p95Ms: number | null;
    p99Ms: number | null;
    avgBytes: number;
    rps: number;
  };
  byPlugin: Array<{
    plugin: string;
    total: number;
    errors: number;
    errorRate: number;
    avgMs: number;
    p95Ms: number | null;
    p99Ms: number | null;
    avgBytes: number;
    rps: number;
  }>;
};

function fmtMs(v: number | null | undefined) {
  if (v === null || v === undefined) return "-";
  if (!Number.isFinite(v)) return "-";
  return `${Math.round(v)}ms`;
}

function fmtPct(v: number | null | undefined) {
  if (v === null || v === undefined) return "-";
  if (!Number.isFinite(v)) return "-";
  return `${(v * 100).toFixed(2)}%`;
}

function fmtNum(v: number | null | undefined) {
  if (v === null || v === undefined) return "-";
  if (!Number.isFinite(v)) return "-";
  return `${Math.round(v)}`;
}

export default function OverviewPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Overview | null>(null);
  const [adminCards, setAdminCards] = useState<AdminCardConfig[]>([]);

  const load = async () => {
    const ok = await requireAdminSession(() => router.replace("/login"));
    if (!ok) return;
    setLoading(true);
    try {
      const [metricsRes, cardsRes] = await Promise.all([
        adminApi.getMetricsOverview(300),
        adminApi.getAdminCards({ placement: "overview" }),
      ]);
      setData(metricsRes as any);
      setAdminCards((cardsRes.data || []) as AdminCardConfig[]);
    } catch {
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let stopped = false;

    const run = async () => {
      if (stopped) return;
      await load();
    };

    run();
    const t = window.setInterval(run, 5000);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topPlugins = useMemo(() => {
    const list = data?.byPlugin || [];
    return list.slice(0, 15);
  }, [data]);

  return (
    <AdminShell title="概览">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">数据概览</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          最近 5 分钟请求统计，仅管理员可见，每 5 秒自动刷新。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">暂无数据</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">总请求数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{fmtNum(data.global.total)}</div>
                <div className="mt-1 text-xs text-muted-foreground">window: {data.windowSeconds}s</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">错误率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{fmtPct(data.global.errorRate)}</div>
                <div className="mt-1 text-xs text-muted-foreground">errors: {fmtNum(data.global.errors)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">平均耗时</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{fmtMs(data.global.avgMs)}</div>
                <div className="mt-1 text-xs text-muted-foreground">p95: {fmtMs(data.global.p95Ms)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">吞吐 (RPS)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.global.rps.toFixed(2)}</div>
                <div className="mt-1 text-xs text-muted-foreground">p99: {fmtMs(data.global.p99Ms)}</div>
              </CardContent>
            </Card>
          </div>

          <AdminCards cards={adminCards} />

          <Card>
            <CardHeader>
              <CardTitle>Top 插件（按请求量）</CardTitle>
            </CardHeader>
            <CardContent>
              {topPlugins.length ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>插件</TableHead>
                        <TableHead>请求</TableHead>
                        <TableHead>错误率</TableHead>
                        <TableHead>平均耗时</TableHead>
                        <TableHead>p95</TableHead>
                        <TableHead>RPS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPlugins.map((p) => (
                        <TableRow key={p.plugin}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{p.plugin}</span>
                              {p.plugin === "unknown" ? (
                                <Badge variant="secondary">unknown</Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{fmtNum(p.total)}</TableCell>
                          <TableCell>{fmtPct(p.errorRate)}</TableCell>
                          <TableCell>{fmtMs(p.avgMs)}</TableCell>
                          <TableCell>{fmtMs(p.p95Ms)}</TableCell>
                          <TableCell>{p.rps.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无插件请求数据</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
