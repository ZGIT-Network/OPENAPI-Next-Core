import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

function normalizeAdminPanelEntry(raw: string | undefined) {
  const value = String(raw || "/admin").trim();
  if (!value || value === "/") return "/admin";

  let normalized = value.startsWith("/") ? value : `/${value}`;
  normalized = normalized.replace(/\/+$/, "");
  return normalized || "/admin";
}

function readPanelEntryFromRootConfig() {
  try {
    const configPath = path.join(__dirname, "..", "config.ini");
    const text = fs.readFileSync(configPath, "utf-8");
    const match = text.match(/^\s*panelEntry\s*=\s*(.+?)\s*$/m);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

const configuredPanelEntry = normalizeAdminPanelEntry(readPanelEntryFromRootConfig());
const defaultBasePath = configuredPanelEntry === "/admin" ? "" : configuredPanelEntry;
const basePath = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || defaultBasePath;
const openapiVersion = process.env.NEXT_PUBLIC_OPENAPI_VERSION || "2.0";

const nextConfig: NextConfig = {
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_OPENAPI_VERSION: openapiVersion,
    NEXT_PUBLIC_ADMIN_BASE_PATH: basePath,
  },
};

export default nextConfig;
