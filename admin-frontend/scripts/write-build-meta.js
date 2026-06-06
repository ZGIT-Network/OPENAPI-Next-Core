const fs = require("node:fs");
const path = require("node:path");

const frontendDir = path.join(__dirname, "..");
const projectRoot = path.join(frontendDir, "..");
const buildDir = path.join(frontendDir, ".next");

function statMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function latestMtimeMs(dirPath) {
  let latest = 0;
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.name === ".next" || entry.name === "node_modules") continue;
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        latest = Math.max(latest, latestMtimeMs(entryPath));
      } else if (entry.isFile()) {
        latest = Math.max(latest, statMtimeMs(entryPath));
      }
    }
  } catch {
    return latest;
  }
  return latest;
}

function normalizeAdminPanelEntry(raw) {
  const value = String(raw || "/admin").trim();
  if (!value || value === "/") return "/admin";
  let normalized = value.startsWith("/") ? value : `/${value}`;
  normalized = normalized.replace(/\/+$/, "");
  return normalized || "/admin";
}

function readIniValue(section, key) {
  try {
    const text = fs.readFileSync(path.join(projectRoot, "config.ini"), "utf-8");
    const sectionMatch = text.match(new RegExp(`\\[${section}\\]([\\s\\S]*?)(?:\\n\\[|$)`));
    const body = sectionMatch ? sectionMatch[1] : text;
    const keyMatch = body.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, "m"));
    return keyMatch ? keyMatch[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

function readBuildConfigBasePath() {
  try {
    const requiredFiles = JSON.parse(
      fs.readFileSync(path.join(buildDir, "required-server-files.json"), "utf-8")
    );
    return requiredFiles && requiredFiles.config ? requiredFiles.config.basePath || "" : "";
  } catch {
    return "";
  }
}

const panelEntry = normalizeAdminPanelEntry(readIniValue("admin", "panelEntry"));
const fallbackBasePath = panelEntry === "/admin" ? "" : panelEntry;
const basePath = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || readBuildConfigBasePath() || fallbackBasePath;
const port = readIniValue("app", "port") || "3101";

const meta = {
  version: 1,
  basePath,
  assetPrefix: basePath || "",
  env: {
    NEXT_PUBLIC_ADMIN_BASE_PATH: basePath,
    ADMIN_INTERNAL_API_BASE_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_OPENAPI_VERSION: process.env.NEXT_PUBLIC_OPENAPI_VERSION || "2.0.0",
  },
  packageMtimeMs: statMtimeMs(path.join(frontendDir, "package.json")),
  lockMtimeMs: statMtimeMs(path.join(frontendDir, "package-lock.json")),
  nextConfigMtimeMs: statMtimeMs(path.join(frontendDir, "next.config.ts")),
  sourceMtimeMs: latestMtimeMs(path.join(frontendDir, "src")),
  appMtimeMs: latestMtimeMs(path.join(frontendDir, "app")),
};

fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(path.join(buildDir, "openapi-admin-build.json"), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`[AdminBuild] wrote openapi-admin-build.json for basePath ${basePath || "/"}`);
