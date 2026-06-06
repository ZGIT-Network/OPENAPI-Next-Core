"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal, TriangleAlertIcon } from "lucide-react";

import { adminApi } from "@/lib/api";
import { requireAdminSession } from "@/lib/adminAuth";

import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type PluginItem = {
  name: string;
  type: "file" | "dir";
  enabled: boolean;
  hasManifest: boolean;
  generation?: "Legacy" | "Next";
  pluginVersion?: string | null;
  pluginAuthor?: string | null;
  pluginType?: string | null;
  physicallyDisabled?: boolean;
};

function GenerationBadge({ generation }: { generation?: "Legacy" | "Next" }) {
  if (generation === "Next") {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        NEXT
      </span>
    );
  }

  if (generation === "Legacy") {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
        LEGACY
      </span>
    );
  }

  return <Badge variant="secondary">-</Badge>;
}

function InstallTabContent({ children }: { children: React.ReactNode }) {
  return <div className="animate-admin-panel-in space-y-4">{children}</div>;
}

export default function PluginsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PluginItem[]>([]);
  const [installOpen, setInstallOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [pluginName, setPluginName] = useState("");
  const [url, setUrl] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);

  const enabledCount = useMemo(() => items.filter((i) => i.enabled).length, [items]);

  const load = async () => {
    const ok = await requireAdminSession(() => router.replace("/login"));
    if (!ok) return;
    setLoading(true);
    try {
      const res = await adminApi.listPlugins();
      setItems(res.data || []);
    } catch {
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetInstallForm = () => {
    setFile(null);
    setPluginName("");
    setUrl("");
    setUpdateExisting(false);
  };

  const applyLogicalToggle = async (name: string, nextEnabled: boolean) => {
    try {
      setBusy(true);
      if (nextEnabled) await adminApi.enablePlugin(name);
      else await adminApi.disablePlugin(name);
      toast.success(nextEnabled ? "已启用" : "已禁用");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const doPhysicalDisable = async (name: string) => {
    try {
      setBusy(true);
      await adminApi.disablePhysical(name);
      toast.success("已物理禁用");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const doPhysicalEnable = async (name: string) => {
    try {
      setBusy(true);
      await adminApi.enablePhysical(name);
      toast.success("已物理启用");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const doUninstall = async (name: string) => {
    try {
      setBusy(true);
      await adminApi.uninstallPlugin(name);
      toast.success("已卸载");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "卸载失败");
    } finally {
      setBusy(false);
    }
  };

  const doUploadZip = async () => {
    if (!file) {
      toast.error("请选择 zip 文件");
      return;
    }

    setBusy(true);
    try {
      await adminApi.installZip(file, pluginName || undefined, updateExisting);
      toast.success(updateExisting ? "更新成功" : "安装成功");
      setInstallOpen(false);
      resetInstallForm();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "安装失败");
    } finally {
      setBusy(false);
    }
  };

  const doInstallFromUrl = async () => {
    if (!url) {
      toast.error("请输入 URL");
      return;
    }

    setBusy(true);
    try {
      await adminApi.installFromUrl(url, pluginName || undefined, updateExisting);
      toast.success(updateExisting ? "更新成功" : "安装成功");
      setInstallOpen(false);
      resetInstallForm();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "安装失败");
    } finally {
      setBusy(false);
    }
  };

  const updateToggle = (
    <button
      type="button"
      onClick={() => setUpdateExisting((v) => !v)}
      className="flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm"
      aria-pressed={updateExisting}
    >
      <span className={`mt-0.5 h-4 w-4 rounded-sm border ${updateExisting ? "bg-primary" : "bg-background"}`} />
      <span>
        <span className="block font-medium">覆盖更新同名插件</span>
        <span className="text-muted-foreground">
          开启后会替换同名插件文件并重新加载；关闭时，同名插件会拒绝安装。
        </span>
      </span>
    </button>
  );

  return (
    <AdminShell title="插件">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">插件管理</h1>
          <p className="text-sm text-muted-foreground">
            已启用 {enabledCount} / 共 {items.length}
          </p>
        </div>

        <Dialog
          open={installOpen}
          onOpenChange={(open) => {
            setInstallOpen(open);
            if (!open) resetInstallForm();
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={busy}>安装插件</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>安装插件</DialogTitle>
              <DialogDescription>
                支持上传 zip 或从 URL 下载 zip。URL 的 hostname 必须在 <code>config.ini</code> 的{" "}
                <code>admin.installAllowedHosts</code> 白名单内。
              </DialogDescription>
            </DialogHeader>

            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>安装风险提示</AlertTitle>
              <AlertDescription>
                插件会被动态加载到当前服务进程。安装前请确认来源可信，更新同名插件会替换旧文件。
              </AlertDescription>
            </Alert>

            <Tabs defaultValue="upload">
              <TabsList>
                <TabsTrigger value="upload">上传 ZIP</TabsTrigger>
                <TabsTrigger value="url">从 URL</TabsTrigger>
                <TabsTrigger value="legacy">Legacy</TabsTrigger>
              </TabsList>

              <TabsContent value="upload">
                <InstallTabContent>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP 文件</Label>
                    <Input
                      id="zip"
                      type="file"
                      accept=".zip"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pluginName">插件名（可选）</Label>
                    <Input
                      id="pluginName"
                      value={pluginName}
                      onChange={(e) => setPluginName(e.target.value)}
                      placeholder="zip 根目录不是 pluginName/ 时填写"
                    />
                  </div>
                  {updateToggle}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInstallOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={doUploadZip} disabled={busy}>
                      {busy ? "处理中..." : updateExisting ? "更新" : "安装"}
                    </Button>
                  </DialogFooter>
                </InstallTabContent>
              </TabsContent>

              <TabsContent value="url">
                <InstallTabContent>
                  <div className="space-y-2">
                    <Label htmlFor="url">ZIP URL</Label>
                    <Input
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://.../plugin.zip"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pluginName2">插件名（可选）</Label>
                    <Input
                      id="pluginName2"
                      value={pluginName}
                      onChange={(e) => setPluginName(e.target.value)}
                      placeholder="zip 根目录不是 pluginName/ 时填写"
                    />
                  </div>
                  {updateToggle}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInstallOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={doInstallFromUrl} disabled={busy}>
                      {busy ? "处理中..." : updateExisting ? "更新" : "安装"}
                    </Button>
                  </DialogFooter>
                </InstallTabContent>
              </TabsContent>

              <TabsContent value="legacy">
                <InstallTabContent>
                  <div className="space-y-2">
                    <Label>Legacy 插件说明</Label>
                    <p className="text-sm text-muted-foreground">
                      Legacy 插件仍可通过放置文件到 <code>apis/</code> 使用；新插件建议使用目录式 Next 结构，
                      以获得 manifest、后台资源和管理卡片能力。
                    </p>
                  </div>
                </InstallTabContent>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>代际</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    暂无插件
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p) => {
                  const stateBadge = p.physicallyDisabled
                    ? { text: "物理禁用", variant: "destructive" as const }
                    : p.enabled
                    ? { text: "启用", variant: "default" as const }
                    : { text: "禁用", variant: "secondary" as const };

                  return (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">
                        <Link
                          className="text-foreground underline-offset-4 hover:underline"
                          href={`/plugins/${encodeURIComponent(p.name)}`}
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <GenerationBadge generation={p.generation} />
                      </TableCell>
                      <TableCell>
                        {p.pluginVersion ? <Badge variant="outline">{p.pluginVersion}</Badge> : <Badge variant="secondary">-</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stateBadge.variant}>{stateBadge.text}</Badge>
                        {p.hasManifest ? <Badge className="ml-2">manifest</Badge> : null}
                        {p.pluginType ? <Badge className="ml-2" variant="outline">{p.pluginType}</Badge> : null}
                        {p.pluginAuthor ? <Badge className="ml-2" variant="outline">作者：{p.pluginAuthor}</Badge> : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant={p.enabled ? "destructive" : "default"}
                                disabled={busy || !!p.physicallyDisabled}
                              >
                                {p.enabled ? "禁用" : "启用"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认{p.enabled ? "禁用" : "启用"}插件？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  这是逻辑{p.enabled ? "禁用" : "启用"}，不会修改文件名。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => applyLogicalToggle(p.name, !p.enabled)}>
                                  确认
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" disabled={busy}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>高级操作</DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {p.physicallyDisabled ? (
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
                                        将 <code>{p.name}</code> 从 <code>.disabled</code> 改回原名，并重新加载插件。
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>取消</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => doPhysicalEnable(p.name)}>确认</AlertDialogAction>
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
                                        将插件文件或目录重命名为 <code>.disabled</code>，重启后也不会加载。
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>取消</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => doPhysicalDisable(p.name)}>确认</AlertDialogAction>
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
                                      将删除 <code>apis</code> 下的插件文件或目录。此操作不可恢复。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => doUninstall(p.name)}>确认卸载</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminShell>
  );
}
