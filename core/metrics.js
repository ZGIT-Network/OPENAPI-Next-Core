const MAX_WINDOW_MS = 5 * 60 * 1000;

let startedAt = Date.now();
let events = []; // {ts, path, plugin, method, status, elapsedMs, sizeBytes}

function normalizePath(p) {
  const raw = (p || '').split('?')[0];
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function shouldIgnorePath(p) {
  const raw = normalizePath(p);

  // 管理接口本身不计入（管理面板访问产生的噪声）
  if (raw.startsWith('/admin/api')) return true;
  if (raw === '/admin' || raw.startsWith('/admin/')) return true;

  // Next/静态资源噪声
  if (raw.startsWith('/_next')) return true;
  if (raw === '/favicon.ico') return true;
  if (raw === '/robots.txt') return true;
  if (raw === '/sitemap.xml') return true;

  // 根路径（通常是说明页/健康页），默认不计入插件统计
  if (raw === '/') return true;

  return false;
}

function getPluginFromPath(p) {
  const raw = normalizePath(p);
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return null;

  // 兜底：避免把 admin/_next 记作 plugin
  if (parts[0] === 'admin' || parts[0] === '_next') return null;

  return parts[0];
}

function prune(now = Date.now()) {
  const cutoff = now - MAX_WINDOW_MS;
  if (!events.length) return;
  // events 按时间递增 push，使用 while 快速剪裁
  while (events.length && events[0].ts < cutoff) {
    events.shift();
  }
}

function recordRequest({ path, method, status, elapsedMs, sizeBytes, ts }) {
  if (shouldIgnorePath(path)) return;

  const now = ts || Date.now();
  events.push({
    ts: now,
    path: String(path || ''),
    plugin: getPluginFromPath(path),
    method: String(method || ''),
    status: Number(status || 0),
    elapsedMs: Number(elapsedMs || 0),
    sizeBytes: Number(sizeBytes || 0),
  });
  prune(now);
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(list, windowSeconds) {
  const total = list.length;
  let errors = 0;
  let sumMs = 0;
  let sumBytes = 0;
  const times = [];

  for (const e of list) {
    if (e.status >= 400) errors++;
    sumMs += e.elapsedMs;
    sumBytes += e.sizeBytes;
    times.push(e.elapsedMs);
  }

  times.sort((a, b) => a - b);

  return {
    total,
    errors,
    errorRate: total ? errors / total : 0,
    avgMs: total ? sumMs / total : 0,
    p95Ms: percentile(times, 95),
    p99Ms: percentile(times, 99),
    avgBytes: total ? sumBytes / total : 0,
    rps: windowSeconds ? total / windowSeconds : 0,
  };
}

function getOverview({ windowSeconds = 300 } = {}) {
  const now = Date.now();
  prune(now);

  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;
  const recent = events.filter((e) => e.ts >= cutoff);

  // 全局汇总
  const global = summarize(recent, windowSeconds);

  // 按 plugin 汇总
  const byPluginMap = new Map();
  for (const e of recent) {
    const key = e.plugin || 'unknown';
    if (!byPluginMap.has(key)) byPluginMap.set(key, []);
    byPluginMap.get(key).push(e);
  }

  const byPlugin = Array.from(byPluginMap.entries()).map(([plugin, list]) => ({
    plugin,
    ...summarize(list, windowSeconds),
  }));

  // 默认按请求量排序
  byPlugin.sort((a, b) => b.total - a.total);

  return {
    ok: true,
    windowSeconds,
    startedAt,
    now,
    global,
    byPlugin,
  };
}

function reset() {
  startedAt = Date.now();
  events = [];
}

module.exports = {
  recordRequest,
  getOverview,
  reset,
};
