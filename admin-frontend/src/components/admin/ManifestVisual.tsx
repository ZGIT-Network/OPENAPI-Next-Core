"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Manifest = Record<string, any>;

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

export function displayValue(value: any) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function FieldBadges({ field }: { field: any }) {
  return (
    <div className="flex flex-wrap gap-1">
      {field?.type ? <Badge variant="secondary">{String(field.type)}</Badge> : null}
      {field?.required ? <Badge>required</Badge> : null}
      {field?.readonly ? <Badge variant="outline">readonly</Badge> : null}
      {field?.widget ? <Badge variant="secondary">{String(field.widget)}</Badge> : null}
      {field?.format ? <Badge variant="outline">{String(field.format)}</Badge> : null}
      {Array.isArray(field?.enum) ? <Badge variant="secondary">enum {field.enum.length}</Badge> : null}
    </div>
  );
}

export function ManifestVisual({ manifest }: { manifest: Manifest }) {
  const resources = asArray(manifest.admin?.resources);
  const cards = asArray(manifest.admin?.cards);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">名称：</span>{displayValue(manifest.name)}</div>
            <div><span className="text-muted-foreground">标题：</span>{displayValue(manifest.title)}</div>
            <div><span className="text-muted-foreground">类型：</span>{displayValue(manifest.type)}</div>
            <div><span className="text-muted-foreground">作者：</span>{displayValue(manifest.author)}</div>
            <div><span className="text-muted-foreground">版本：</span>{displayValue(manifest.version)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">导航</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">分组：</span>{displayValue(manifest.nav?.group)}</div>
            <div className="break-all"><span className="text-muted-foreground">路径：</span>{displayValue(manifest.nav?.path)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin 注册</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">资源：</span>{resources.length}</div>
            <div><span className="text-muted-foreground">卡片：</span>{cards.length}</div>
            <div className="flex flex-wrap gap-2">
              {resources.length ? <Badge>resources</Badge> : <Badge variant="secondary">no resources</Badge>}
              {cards.length ? <Badge>cards</Badge> : <Badge variant="secondary">no cards</Badge>}
            </div>
          </CardContent>
        </Card>
      </div>

      {cards.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">注册卡片</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>位置</TableHead>
                    <TableHead>Endpoint</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.map((card: any, idx: number) => (
                    <TableRow key={String(card.id || idx)}>
                      <TableCell className="font-medium">{displayValue(card.id)}</TableCell>
                      <TableCell>{displayValue(card.title)}</TableCell>
                      <TableCell><Badge variant="secondary">{displayValue(card.placement || card.scope || "overview")}</Badge></TableCell>
                      <TableCell className="break-all">{displayValue(card.endpoint)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {resources.length ? (
        <div className="space-y-3">
          {resources.map((resource: any, idx: number) => {
            const fields = resource.fields && typeof resource.fields === "object" ? resource.fields : {};
            const fieldEntries = Object.entries(fields);
            const overviewCards = asArray(resource.overview?.cards);

            return (
              <Card key={String(resource.id || idx)}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{displayValue(resource.title || resource.id || "未命名资源")}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {resource.table ? <Badge variant="secondary">table: {displayValue(resource.table)}</Badge> : null}
                      {resource.primaryKey ? <Badge variant="outline">pk: {displayValue(resource.primaryKey)}</Badge> : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {asArray(resource.permissions).map((permission: any) => (
                      <Badge key={String(permission)}>{String(permission)}</Badge>
                    ))}
                    {!asArray(resource.permissions).length ? <Badge variant="secondary">no permissions</Badge> : null}
                  </div>

                  {fieldEntries.length ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>字段</TableHead>
                            <TableHead>标签</TableHead>
                            <TableHead>属性</TableHead>
                            <TableHead>枚举</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fieldEntries.map(([name, def]: [string, any]) => (
                            <TableRow key={name}>
                              <TableCell className="font-medium">{name}</TableCell>
                              <TableCell>{displayValue(def?.label)}</TableCell>
                              <TableCell><FieldBadges field={def} /></TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {Array.isArray(def?.enum) ? def.enum.map(String).join(", ") : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">未声明字段</p>
                  )}

                  {overviewCards.length ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">资源概览卡片</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {overviewCards.map((card: any, cardIdx: number) => (
                          <div key={String(card.id || cardIdx)} className="rounded-md border px-3 py-2 text-sm">
                            <div className="font-medium">{displayValue(card.title || card.id)}</div>
                            <div className="mt-1 break-all text-xs text-muted-foreground">{displayValue(card.endpoint)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">未声明 admin.resources。</p>
      )}
    </div>
  );
}
