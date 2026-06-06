"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { requireAdminSession } from "@/lib/adminAuth";

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

type ListResponse = {
  ok: boolean;
  data: any[];
  paging?: { limit: number; offset: number };
};

function isLongField(fieldName: string, def: any) {
  if (def && typeof def === "object" && def.type === "text") return true;
  return /note|desc|description|content/i.test(fieldName);
}

function isEnumField(def: any): def is { enum: any[] } {
  return !!def && typeof def === "object" && Array.isArray(def.enum) && def.enum.length > 0;
}

function isBooleanField(def: any) {
  if (!def || typeof def !== "object") return false;
  if (def.type === "boolean") return true;
  if (def.widget === "switch") return true;
  return false;
}

function coerceValueForField(def: any, v: any) {
  if (!def || typeof def !== "object") return v;

  if (isBooleanField(def)) {
    if (typeof v === "boolean") return v;
    if (v === "1" || v === 1 || v === "true" || v === true) return true;
    if (v === "0" || v === 0 || v === "false" || v === false) return false;
    return !!v;
  }

  if (def.type === "number") {
    if (v === "" || v === null || v === undefined) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }

  return v;
}

export default function DataResourceClientPage() {
  const router = useRouter();
  const params = useParams<{ plugin: string; resource: string }>();
  const plugin = params?.plugin ? String(params.plugin) : "";
  const resource = params?.resource ? String(params.resource) : "";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [resourcesIndex, setResourcesIndex] = useState<PluginResources[]>([]);

  const [limit] = useState(30);
  const [offset, setOffset] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "update">("create");
  const [editRow, setEditRow] = useState<any>({});

  const [overviewCards, setOverviewCards] = useState<any[]>([]);
  const [overviewData, setOverviewData] = useState<Record<string, any>>({});
  const [overviewLoading, setOverviewLoading] = useState(false);

  const loadIndex = async () => {
    const resp = await fetch("/admin/api/data/resources", {
      credentials: "same-origin",
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error((json && json.error) || `HTTP ${resp.status}`);
    setResourcesIndex(json.data || []);
  };

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const resp = await fetch(
        `/admin/api/data/${encodeURIComponent(plugin)}/${encodeURIComponent(resource)}/overview`,
        {
          credentials: "same-origin",
        }
      );
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error((json && json.error) || `HTTP ${resp.status}`);

      const cards = (json && json.data && Array.isArray(json.data.cards)) ? json.data.cards : [];
      setOverviewCards(cards);

      // 逐个拉取插件暴露的 endpoint 数据
      const entries = await Promise.all(
        cards.map(async (c: any) => {
          const id = String(c.id || '');
          const endpoint = String(c.endpoint || '');
          if (!id || !endpoint) return [id || Math.random().toString(36), { ok: false, error: 'invalid card' }];

          try {
            const r = await fetch(endpoint);
            const j = await r.json().catch(() => null);
            if (!r.ok) throw new Error((j && (j.error || j.msg)) || `HTTP ${r.status}`);
            return [id, { ok: true, data: j }];
          } catch (e) {
            return [id, { ok: false, error: e instanceof Error ? e.message : String(e) }];
          }
        })
      );

      const next: Record<string, any> = {};
      for (const [k, v] of entries) next[String(k)] = v;
      setOverviewData(next);
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadRows = async () => {
    const resp = await fetch(
      `/admin/api/data/${encodeURIComponent(plugin)}/${encodeURIComponent(resource)}?limit=${limit}&offset=${offset}`,
      {
        credentials: "same-origin",
      }
    );
    const json: ListResponse | any = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error((json && json.error) || `HTTP ${resp.status}`);
    setRows(json.data || []);
  };

  const loadAll = async () => {
    const ok = await requireAdminSession(() => router.replace("/login"));
    if (!ok) return;
    setLoading(true);
    try {
      await loadIndex();
      await loadRows();
      await loadOverview();
    } catch (e) {
      router.replace("/login");
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin, resource, offset]);

  const currentResource = useMemo(() => {
    for (const p of resourcesIndex) {
      if (p.plugin !== plugin) continue;
      for (const r of p.resources || []) {
        if (r.id === resource) return r;
      }
    }
    return null;
  }, [resourcesIndex, plugin, resource]);

  const pluginTitle = useMemo(() => {
    const p = resourcesIndex.find((x) => x.plugin === plugin);
    return p?.title || plugin;
  }, [resourcesIndex, plugin]);

  const fields = useMemo(() => currentResource?.fields || {}, [currentResource]);
  const fieldKeys = useMemo(() => Object.keys(fields), [fields]);
  const primaryKey = useMemo(() => currentResource?.primaryKey || "id", [currentResource]);
  const permissions = useMemo(
    () => (currentResource?.permissions || []).map(String),
    [currentResource]
  );

  const openCreate = () => {
    setEditMode("create");
    setEditRow({});
    setEditOpen(true);
  };

  const openEdit = (row: any) => {
    setEditMode("update");
    setEditRow({ ...row });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    try {
      const writableKeys = fieldKeys.filter((k) => {
        const def = fields[k];
        if (k === primaryKey) return false;
        if (def && typeof def === "object" && def.readonly) return false;
        return true;
      });

      const payload: any = {};
      for (const k of writableKeys) {
        if (editRow[k] !== undefined) payload[k] = editRow[k];
      }

      if (editMode === "create") {
        if (!permissions.includes("create")) throw new Error("forbidden");
        const resp = await fetch(
          `/admin/api/data/${encodeURIComponent(plugin)}/${encodeURIComponent(resource)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify(payload),
          }
        );
        const json = await resp.json().catch(() => null);
        if (!resp.ok) throw new Error((json && json.error) || `HTTP ${resp.status}`);
        toast.success("已新增");
      } else {
        if (!permissions.includes("update")) throw new Error("forbidden");
        const id = editRow[primaryKey];
        if (id === undefined || id === null || id === "") throw new Error("missing id");
        const resp = await fetch(
          `/admin/api/data/${encodeURIComponent(plugin)}/${encodeURIComponent(resource)}/${encodeURIComponent(
            String(id)
          )}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify(payload),
          }
        );
        const json = await resp.json().catch(() => null);
        if (!resp.ok) throw new Error((json && json.error) || `HTTP ${resp.status}`);
        toast.success("已保存");
      }

      setEditOpen(false);
      await loadRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const doDelete = async (row: any) => {
    try {
      if (!permissions.includes("delete")) throw new Error("forbidden");
      const id = row[primaryKey];
      if (id === undefined || id === null || id === "") throw new Error("missing id");

      const resp = await fetch(
        `/admin/api/data/${encodeURIComponent(plugin)}/${encodeURIComponent(resource)}/${encodeURIComponent(
          String(id)
        )}?confirm=true`,
        {
          method: "DELETE",
          credentials: "same-origin",
        }
      );
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error((json && json.error) || `HTTP ${resp.status}`);

      toast.success("已删除");
      await loadRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const canCreate = permissions.includes("create");

  const canPrev = offset > 0;
  const canNext = rows.length === limit;

  return (
    <AdminShell title={`数据：${plugin}/${resource}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {currentResource?.title || resource}
          </h1>
          <p className="text-sm text-muted-foreground">
            {pluginTitle} / {plugin} · table: {currentResource?.table || "-"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">pk: {primaryKey}</Badge>
            {permissions.map((p) => (
              <Badge key={p}>{p}</Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/data")}>返回</Button>
          <Button variant="outline" onClick={() => loadRows()} disabled={loading}>刷新</Button>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            {canCreate ? (
            <DialogTrigger asChild>
                <Button onClick={openCreate}>
                新增
              </Button>
            </DialogTrigger>
            ) : null}
            <DialogContent className="sm:max-w-[680px]">
              <DialogHeader>
                <DialogTitle>{editMode === "create" ? "新增" : "编辑"}</DialogTitle>
                <DialogDescription>编辑资源数据字段。</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fieldKeys.map((k) => {
                  const def: any = fields[k];
                  const readonly = k === primaryKey || (def && def.readonly);
                  const label = def?.label || k;

                  return (
                    <div key={k} className={isLongField(k, def) ? "sm:col-span-2" : ""}>
                      <Label className="mb-2 block">{label}{readonly ? "（只读）" : ""}</Label>

                      {isBooleanField(def) ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className={
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
                              (coerceValueForField(def, editRow[k]) ? "bg-primary" : "bg-muted")
                            }
                            onClick={() => {
                              if (readonly) return;
                              setEditRow((r: any) => ({
                                ...r,
                                [k]: !coerceValueForField(def, r[k]),
                              }));
                            }}
                            disabled={readonly}
                            aria-pressed={coerceValueForField(def, editRow[k])}
                          >
                            <span
                              className={
                                "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform " +
                                (coerceValueForField(def, editRow[k]) ? "translate-x-5" : "translate-x-1")
                              }
                            />
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {coerceValueForField(def, editRow[k]) ? "开" : "关"}
                          </span>
                        </div>
                      ) : isEnumField(def) ? (
                        <Select
                          value={String(editRow[k] ?? "")}
                          onValueChange={(v) =>
                            setEditRow((r: any) => ({
                              ...r,
                              [k]: (def as any)?.type === "number" ? Number(v) : v,
                            }))
                          }
                          disabled={readonly}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="请选择" />
                          </SelectTrigger>
                          <SelectContent>
                            {def.enum.map((opt: any) => (
                              <SelectItem key={String(opt)} value={String(opt)}>
                                {String(opt)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : isLongField(k, def) ? (
                        <Textarea
                          value={editRow[k] ?? ""}
                          onChange={(e) =>
                            setEditRow((r: any) => ({ ...r, [k]: e.target.value }))
                          }
                          disabled={readonly}
                        />
                      ) : (
                        <Input
                          value={editRow[k] ?? ""}
                          onChange={(e) =>
                            setEditRow((r: any) => ({
                              ...r,
                              [k]: coerceValueForField(def, e.target.value),
                            }))
                          }
                          disabled={readonly}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
                <Button onClick={submitEdit}>保存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : (
        <div className="space-y-4">
          {overviewCards.length ? (
            <Card>
              <CardHeader>
                <CardTitle>数据概览</CardTitle>
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <p className="text-sm text-muted-foreground">概览加载中...</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {overviewCards.map((c: any) => {
                      const id = String(c.id || "");
                      const title = String(c.title || id || "概览");
                      const state = overviewData[id];

                      // 约定：插件 endpoint 返回 { code/msg/data } 或 { ok/data }
                      const payload = state && state.ok ? state.data : null;
                      const data = payload && (payload.data ?? payload);

                      const displayValue = (() => {
                        if (!data) return "-";
                        if (typeof data === "number" || typeof data === "string") return String(data);
                        if (data && typeof data === "object") {
                          if (data.value !== undefined) return String(data.value);
                          if (data.total !== undefined) return String(data.total);
                          if (data.count !== undefined) return String(data.count);
                        }
                        return "-";
                      })();

                      return (
                        <Card key={id}>
                          <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {state && state.ok ? (
                              <div className="text-2xl font-semibold">{displayValue}</div>
                            ) : state && state.error ? (
                              <p className="text-sm text-destructive">{String(state.error)}</p>
                            ) : (
                              <div className="text-2xl font-semibold">-</div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

        <Card>
          <CardHeader>
            <CardTitle>数据列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {fieldKeys.map((k) => (
                      <TableHead key={k}>{fields[k]?.label || k}</TableHead>
                    ))}
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={fieldKeys.length + 1}
                        className="text-sm text-muted-foreground"
                      >
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, idx) => (
                      <TableRow key={String(row[primaryKey] ?? idx)}>
                        {fieldKeys.map((k) => (
                          <TableCell key={k} className="max-w-[260px] truncate">
                            {row[k] === null || row[k] === undefined ? "" : String(row[k])}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(row)}
                              disabled={!permissions.includes("update")}
                            >
                              编辑
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={!permissions.includes("delete")}
                                >
                                  删除
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    将删除该条记录（{primaryKey}={String(row[primaryKey])}）。此操作不可恢复。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => doDelete(row)}>
                                    确认删除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                limit={limit} offset={offset}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canPrev}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canNext}
                  onClick={() => setOffset(offset + limit)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card></div>
      )}
    </AdminShell>
  );
}
