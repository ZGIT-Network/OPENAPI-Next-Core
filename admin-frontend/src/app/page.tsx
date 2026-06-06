"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { hasAdminSession } from "@/lib/adminAuth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const authenticated = await hasAdminSession();
      if (cancelled) return;
      router.replace(authenticated ? "/overview" : "/login");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
