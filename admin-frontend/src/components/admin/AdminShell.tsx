"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { logoutAdminSession } from "@/lib/adminAuth";

import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <NavigationMenuItem>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          className={
            "px-3 py-2 text-sm rounded-md transition-colors " +
            (active
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {label}
        </Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

export function AdminShell({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const logout = async () => {
    await logoutAdminSession();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold tracking-tight">OpenAPI Admin</div>
            <NavigationMenu>
              <NavigationMenuList>
                <NavItem href="/plugins" label="插件" />
                <NavItem href="/overview" label="概览" />
                <NavItem href="/data" label="数据" />
                <NavItem href="/manifests" label="Manifests" />
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">API v{process.env.NEXT_PUBLIC_OPENAPI_VERSION || "?"}</div>
            {title ? (
              <div className="text-sm text-muted-foreground">{title}</div>
            ) : null}
            <Button variant="outline" size="sm" onClick={logout}>
              退出
            </Button>
          </div>
        </div>
      </header>
      <main>
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
