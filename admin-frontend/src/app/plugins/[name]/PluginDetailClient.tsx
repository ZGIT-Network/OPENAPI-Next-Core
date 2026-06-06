"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import { adminApi } from "@/lib/api";
import { requireAdminSession } from "@/lib/adminAuth";
import { testPluginRequest, type HttpMethod } from "@/lib/pluginRequest";

import { AdminShell } from "@/components/admin/AdminShell";
import { AdminCards, type AdminCardConfig } from "@/components/admin/AdminCards";
import { ManifestVisual } from "@/components/admin/ManifestVisual";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from "@/components/Markdown";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

type Detail = {
  name: string;
  generation?: "Legacy" | "Next";
  type: "file" | "dir";
  enabled: boolean;
  physicallyDisabled?: boolean;
  manifest: any;
  pluginVersion?: string | null;
  meta?: any;
  files?: { sample?: Array<{ name: string; type: string }> };
};

function formatTime(ts?: number | null) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function healthHintText(r: any) {
  if (!r) return null;
  if (r.hint === "html-response" || r.htmlFallback) {
    return "插件健康检查返回了 HTML（通常表示该接口未实现或命中了 404 页面）。";
  }
  if (r.hint === "non-2xx") {
    return "健康检查返回非 2xx 状态码。";
  }
  return null;
}

export default function PluginDetailClientPage() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const name = params?.name;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [healthResult, setHealthResult] = useState<any>(null);
  const [adminCards, setAdminCards] = useState<AdminCardConfig[]>([]);

  const [readme, setReadme] = useState<string | null>(null);

  // 测试接口表单
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState<string>("/");
  const [query, setQuery] = useState<string>("");
  const [jsonBody, setJsonBody] = useState<string>("");
  const [testResult, setTestResult] = useState<any>(null);

  const load = async () => {
    const ok = await requireAdminSession(() => router.replace("/login"));
    if (!ok) return;
    if (!name) return;

    setLoading(true);
    try {
      const res = await adminApi.getPluginDetail(name);
      setDetail(res.data);
      setHealthResult(res.data?.meta?.lastHealth || null);

      try {
        const cards = await adminApi.getAdminCards({
          placement: "plugin-detail",
          plugin: String(name),
        });
        setAdminCards((cards.data || []) as AdminCardConfig[]);
      } catch {
        setAdminCards([]);
      }

      // README.md（可选）
      try {
        const r = await adminApi.getPluginReadme(name);
        setReadme(r?.data?.content ?? null);
      } catch {
        setReadme(null);
      }
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
  }, [name]);

  const applyLogicalToggle = async (nextEnabled: boolean) => {
    if (!detail) return;
    if (detail.physicallyDisabled) {
      toast.error("该插件处于物理禁用状态，请先物理启用");
      return;
    }

    setBusy(true);
    try {
      if (nextEnabled) await adminApi.enablePlugin(detail.name);
      else await adminApi.disablePlugin(detail.name);
      toast.success(nextEnabled ? "已启用" : "已禁用");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const physicalDisable = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await adminApi.disablePhysical(detail.name);
      toast.success("已物理禁用");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const physicalEnable = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await adminApi.enablePhysical(detail.name);
      toast.success("已物理启用");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const uninstall = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await adminApi.uninstallPlugin(detail.name);
      toast.success("已卸载");
      router.replace("/plugins");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "卸载失败");
    } finally {
      setBusy(false);
    }
  };

  const canHealthCheck = !!detail?.manifest?.healthPath;

  const runHealth = async () => {
    if (!detail) return;
    if (!canHealthCheck) {
      toast.error("该插件未配置 manifest.healthPath，无法使用健康检查");
      return;
    }

    setBusy(true);
    try {
      const res = await adminApi.checkHealth(detail.name);
      setHealthResult(res.data);
      if (res.data?.ok) toast.success("健康检查通过");
      else toast.error("健康检查失败");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "健康检查失败");
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      // JSON body 基本校验（可留空）
      const bodyTrim = jsonBody.trim();
      if (bodyTrim) {
        try {
          JSON.parse(bodyTrim);
        } catch {
          toast.error("Body 不是合法 JSON");
          return;
        }
      }

      const res = await testPluginRequest({
        pluginName: detail.name,
        method,
        path,
        query,
        jsonBody,
      });
      setTestResult(res);
      toast.success(res.ok ? "请求成功" : "请求失败");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "请求失败");
    } finally {
      setBusy(false);
    }
  };

  const fileSample = useMemo(() => detail?.files?.sample || [], [detail]);
  const stateBadge = detail?.physicallyDisabled
    ? { text: "物理禁用", variant: "destructive" as const }
    : detail?.enabled
    ? { text: "启用", variant: "default" as const }
    : { text: "禁用", variant: "secondary" as const };

  return (
    <AdminShell title={detail ? `插件：${detail.name}` : "插件详情"}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{detail?.name || name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {detail?.generation ? <Badge>{detail.generation}</Badge> : <Badge variant="secondary">-</Badge>}
            {detail?.pluginVersion ? <Badge variant="outline">{detail.pluginVersion}</Badge> : <Badge variant="secondary">-</Badge>}
            {detail?.type ? <Badge variant="secondary">{detail.type}</Badge> : null}
            {detail ? <Badge variant={stateBadge.variant}>{stateBadge.text}</Badge> : null}
            {detail?.manifest ? <Badge>manifest</Badge> : <Badge variant="secondary">no-manifest</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/plugins")} disabled={busy}>
            返回
          </Button>

          {canHealthCheck ? (
            <Button onClick={runHealth} disabled={busy || !detail}>
              健康检查
            </Button>
          ) : null}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={busy || !detail || !!detail?.physicallyDisabled}>
                {detail?.enabled ? "禁用" : "启用"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认{detail?.enabled ? "禁用" : "启用"}插件？</AlertDialogTitle>
                <AlertDialogDescription>
                  这是逻辑{detail?.enabled ? "禁用" : "启用"}（不会修改文件名）。
                  {detail?.physicallyDisabled ? "\n当前插件处于物理禁用状态，需要先物理启用。" : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={() => applyLogicalToggle(!detail?.enabled)}>
                  确认
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={busy || !detail}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>高级操作</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {detail?.physicallyDisabled ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      物理启用
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认物理启用？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将把插件从 <code>.disabled</code> 改回原名，并重新加载插件。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={physicalEnable}>确认</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      物理禁用
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认物理禁用？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将重命名插件文件/目录为 <code>.disabled</code>，使其不会被加载（重启也生效）。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={physicalDisable}>确认</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <DropdownMenuSeparator />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                    卸载
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认卸载插件？</AlertDialogTitle>
                    <AlertDialogDescription>
                      该操作将删除 apis 下的插件文件/目录，并立即重载插件。此操作不可恢复。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={uninstall}>确认卸载</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : !detail ? (
        <p className="text-sm text-muted-foreground">未找到插件</p>
      ) : (
        <div className="space-y-4">
          <AdminCards cards={adminCards} />

          {readme ? (
            <Card>
              <CardHeader>
                <CardTitle>README</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[520px] bg-background">
                  <Markdown content={readme} />
                </ScrollArea>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>测试接口</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="sm:col-span-1">
                  <div className="mb-2 text-sm text-muted-foreground">方法</div>
                  <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择方法" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <div className="mb-2 text-sm text-muted-foreground">路径（相对插件根，例如 / 或 /health）</div>
                  <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/" />
                </div>
                <div className="sm:col-span-4">
                  <div className="mb-2 text-sm text-muted-foreground">Query（例如 a=1&b=2，可空）</div>
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="a=1&b=2" />
                </div>
                <div className="sm:col-span-4">
                  <div className="mb-2 text-sm text-muted-foreground">JSON Body（仅 POST/PUT/PATCH，可空）</div>
                  <Textarea value={jsonBody} onChange={(e) => setJsonBody(e.target.value)} placeholder="{}" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={runTest} disabled={busy || !detail}>
                  发送请求
                </Button>
                {testResult ? (
                  <Badge variant={testResult.ok ? "default" : "destructive"}>{testResult.status}</Badge>
                ) : null}
              </div>

              {testResult ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground break-all">{testResult.url}</div>
                  <ScrollArea className="h-56 rounded-md border bg-muted p-3">
                    <pre className="text-xs">
                      {testResult.contentType.includes("application/json") && testResult.bodyJson
                        ? JSON.stringify(testResult.bodyJson, null, 2)
                        : testResult.bodyText}
                    </pre>
                  </ScrollArea>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {canHealthCheck ? (
            <Card>
              <CardHeader>
                <CardTitle>健康检查</CardTitle>
              </CardHeader>
              <CardContent>
                {healthResult ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {healthResult.ok ? <Badge>OK</Badge> : <Badge variant="destructive">FAIL</Badge>}
                      <Badge variant="secondary">status: {String(healthResult.status ?? "-")}</Badge>
                      <Badge variant="secondary">{String(healthResult.elapsedMs ?? "-")}ms</Badge>
                      {healthResult.checkedAt ? (
                        <Badge variant="secondary">{formatTime(healthResult.checkedAt)}</Badge>
                      ) : null}
                    </div>

                    {healthHintText(healthResult) ? (
                      <div className="text-sm text-muted-foreground">{healthHintText(healthResult)}</div>
                    ) : null}

                    <div className="break-all text-xs text-muted-foreground">{healthResult.url}</div>
                    {healthResult.error ? (
                      <div className="text-sm text-destructive">{String(healthResult.error)}</div>
                    ) : null}
                    {healthResult.dataPreview ? (
                      <ScrollArea className="h-40 rounded-md border bg-muted p-3">
                        <pre className="text-xs">
                          {typeof healthResult.dataPreview === "string"
                            ? healthResult.dataPreview
                            : JSON.stringify(healthResult.dataPreview, null, 2)}
                        </pre>
                      </ScrollArea>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">尚未执行健康检查</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>元数据</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-md border px-3 py-3">
                  <div className="text-xs text-muted-foreground">安装</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{detail.meta?.installSource || "manual"}</Badge>
                    {detail.generation ? <Badge variant="outline">{detail.generation}</Badge> : null}
                  </div>
                  <div className="mt-2 text-sm">{formatTime(detail.meta?.installedAt)}</div>
                  <div className="mt-1 break-all text-xs text-muted-foreground">{detail.meta?.installUrl || "本地插件或未记录来源"}</div>
                </div>

                <div className="rounded-md border px-3 py-3">
                  <div className="text-xs text-muted-foreground">最近操作</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{detail.meta?.lastAction || "none"}</Badge>
                    <Badge variant={detail.enabled ? "default" : "secondary"}>{detail.enabled ? "启用" : "禁用"}</Badge>
                    {detail.physicallyDisabled ? <Badge variant="destructive">物理禁用</Badge> : null}
                  </div>
                  <div className="mt-2 text-sm">{formatTime(detail.meta?.lastActionAt)}</div>
                  <div className="mt-1 break-all text-xs text-muted-foreground">操作者：{detail.meta?.operator || "-"}</div>
                </div>

                <div className="rounded-md border px-3 py-3">
                  <div className="text-xs text-muted-foreground">健康检查</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.meta?.lastHealth ? (
                      <Badge variant={detail.meta.lastHealth.ok ? "default" : "destructive"}>
                        {detail.meta.lastHealth.ok ? "OK" : "FAIL"}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">未执行</Badge>
                    )}
                    {detail.manifest?.healthPath ? <Badge variant="outline">{detail.manifest.healthPath}</Badge> : null}
                  </div>
                  <div className="mt-2 text-sm">{formatTime(detail.meta?.lastHealth?.checkedAt)}</div>
                  <div className="mt-1 break-all text-xs text-muted-foreground">{detail.meta?.lastHealth?.url || "未记录健康检查结果"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manifest</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.manifest ? (
                <Tabs defaultValue="visual">
                  <TabsList className="mb-3">
                    <TabsTrigger value="visual">可视化</TabsTrigger>
                    <TabsTrigger value="json">JSON</TabsTrigger>
                  </TabsList>
                  <TabsContent value="visual">
                    <ManifestVisual manifest={detail.manifest} />
                  </TabsContent>
                  <TabsContent value="json">
                    <ScrollArea className="h-72 rounded-md border bg-muted p-3">
                      <pre className="text-xs">{JSON.stringify(detail.manifest, null, 2)}</pre>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              ) : (
                <p className="text-sm text-muted-foreground">该插件没有 manifest</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>文件摘要</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.type === "dir" ? (
                fileSample.length ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">展示前 {fileSample.length} 个条目（浅层）</p>
                    <Separator />
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {fileSample.map((f) => (
                        <div
                          key={f.name}
                          className="flex items-center justify-between rounded-md border px-2 py-1 text-xs"
                        >
                          <span className="truncate">{f.name}</span>
                          <Badge variant="secondary">{f.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">目录为空或无法读取</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">单文件插件无目录文件列表</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
