"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export type AdminCardConfig = {
  id: string;
  plugin: string;
  title: string;
  description?: string;
  placement: string;
  endpoint: string;
};

type CardState = {
  loading: boolean;
  ok?: boolean;
  status?: number;
  contentType?: string;
  data?: any;
  text?: string;
  error?: string;
};

async function fetchCard(endpoint: string): Promise<CardState> {
  const response = await fetch(endpoint, { credentials: "same-origin" });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let data: any = null;

  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  return {
    loading: false,
    ok: response.ok,
    status: response.status,
    contentType,
    data,
    text,
  };
}

function renderValue(value: any) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isSimpleRecord(value: any) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => v === null || ["string", "number", "boolean"].includes(typeof v))
  );
}

function AdminCard({ card }: { card: AdminCardConfig }) {
  const [state, setState] = useState<CardState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    fetchCard(card.endpoint)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            loading: false,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [card.endpoint]);

  const payload = state.data && typeof state.data === "object" && "data" in state.data
    ? state.data.data
    : state.data ?? state.text;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{card.title}</CardTitle>
            {card.description ? (
              <div className="mt-1 text-sm text-muted-foreground">{card.description}</div>
            ) : null}
          </div>
          <Badge variant={state.loading ? "secondary" : state.ok ? "default" : "destructive"}>
            {state.loading ? "加载中" : state.status || "ERR"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{card.plugin}</span>
          <span className="break-all">{card.endpoint}</span>
        </div>

        {state.loading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : isSimpleRecord(payload) ? (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(payload).map(([key, value]) => (
              <div key={key} className="rounded-md border px-3 py-2">
                <div className="text-xs text-muted-foreground">{key}</div>
                <div className="mt-1 text-lg font-semibold">{renderValue(value)}</div>
              </div>
            ))}
          </div>
        ) : (
          <ScrollArea className="h-40 rounded-md border bg-muted p-3">
            <pre className="text-xs">{renderValue(payload)}</pre>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminCards({ cards }: { cards: AdminCardConfig[] }) {
  if (!cards.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {cards.map((card) => (
        <AdminCard key={`${card.plugin}:${card.id}:${card.placement}`} card={card} />
      ))}
    </div>
  );
}
