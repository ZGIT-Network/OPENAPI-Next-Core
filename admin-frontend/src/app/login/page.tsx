"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { adminApi } from "@/lib/api";
import { hasAdminSession } from "@/lib/adminAuth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const authenticated = await hasAdminSession();
      if (!cancelled && authenticated) {
        router.replace("/overview");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await adminApi.login(key);
      if (!res.ok || !res.token) {
        throw new Error("登录失败");
      }
      setOpen(false);
      router.replace("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background to-muted/40">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-160px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-200px] left-[-120px] h-[520px] w-[520px] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6">
        <div className="w-full text-center">
          <div className="text-2xl font-semibold tracking-tight text-muted-foreground">
           无权访问。403 Forbidden.
          </div>
          <div className="mt-3 text-lg font-medium tracking-tight text-foreground/80">
            Access denied. Only Administrator can access.
          </div>
         
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 select-none text-sm text-muted-foreground/60 hover:text-foreground"
          aria-label="登录"
        >
          登录
        </button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setError(null);
            setLoading(false);
          }
          setOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>管理员登录</DialogTitle>
            <DialogDescription>请输入 Admin Key 以进入管理后台 <br/>若您忘记密码或不记得设置了密码，请检查配置文件。</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key">Admin Key</Label>
              <Input
                ref={inputRef}
                id="key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="请输入你的 Admin Key"
                autoComplete="current-password"
                required
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "登录中..." : "登录"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
