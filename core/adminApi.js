const express = require('express');
const fs = require('fs');
const path = require('path');
console.log("+ [AdminApi] 初始化管理员API路由");

function safePluginName(name) {
    const value = String(name || '').trim();
    if (!/^[a-zA-Z0-9._-]+$/.test(value)) return null;
    if (value.includes('..') || value.includes('/') || value.includes('\\')) return null;
    return value;
}

function readManifestSource(projectRoot, manifest) {
    const pluginName = safePluginName(manifest && manifest.name);
    if (!pluginName) return null;

    const apisDir = path.join(projectRoot, 'apis');
    const candidates = [
        path.join(apisDir, pluginName, 'manifest.json'),
        path.join(apisDir, `${pluginName}.manifest.json`),
    ];

    for (const filePath of candidates) {
        try {
            if (!fs.existsSync(filePath)) continue;
            return {
                path: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
                content: fs.readFileSync(filePath, 'utf-8'),
            };
        } catch {
            return null;
        }
    }

    return null;
}

function normalizeAdminCard(card, manifest, index) {
    if (!card || typeof card !== 'object') return null;

    const plugin = String(manifest.name || '');
    const id = String(card.id || `${plugin}-card-${index}`);
    const placement = String(card.placement || card.scope || 'overview');
    const endpoint = card.endpoint ? String(card.endpoint) : '';
    if (!endpoint || !endpoint.startsWith('/')) return null;

    return {
        id,
        plugin,
        title: card.title ? String(card.title) : id,
        description: card.description ? String(card.description) : '',
        placement,
        endpoint,
        order: Number.isFinite(Number(card.order)) ? Number(card.order) : index,
    };
}

function getAdminCards(pluginManager, filters = {}) {
    const manifests = pluginManager.getManifests ? pluginManager.getManifests() : [];
    const placement = filters.placement ? String(filters.placement) : '';
    const plugin = filters.plugin ? String(filters.plugin) : '';
    const cards = [];

    for (const manifest of manifests) {
        if (!manifest || typeof manifest !== 'object') continue;
        if (plugin && manifest.name !== plugin) continue;

        const rawCards = Array.isArray(manifest.admin && manifest.admin.cards)
            ? manifest.admin.cards
            : [];

        rawCards.forEach((card, index) => {
            const normalized = normalizeAdminCard(card, manifest, index);
            if (!normalized) return;
            if (placement && normalized.placement !== placement) return;
            cards.push(normalized);
        });
    }

    return cards.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function createAdminApiRouter(adminAuth, pluginManager, config) {
    const router = express.Router();

    // 登录：用 admin key 换 token
    router.post('/auth/login', express.json(), (req, res) => {
        try {
            const key = req.body && req.body.key;
            const result = adminAuth.login(key, req);
            if (!result.ok) {
                if (result.retryAfterSeconds) {
                    res.setHeader('Retry-After', String(result.retryAfterSeconds));
                }
                return res.status(result.status || 401).json({
                    ok: false,
                    error: result.error,
                    retryAfterSeconds: result.retryAfterSeconds,
                });
            }
            adminAuth.setSessionCookie(res, result.token);
            return res.json({ ok: true, token: result.token, ttlSeconds: result.ttlSeconds });
        } catch (e) {
            return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    router.get('/auth/session', (req, res) => {
        try {
            if (!adminAuth.isEnabled()) {
                return res.status(404).json({ ok: false, error: 'not found' });
            }

            const session = adminAuth.getSession(req);
            if (!session.authenticated) {
                return res.json({ ok: true, authenticated: false });
            }

            return res.json(session);
        } catch (e) {
            return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    router.post('/auth/logout', (req, res) => {
        try {
            adminAuth.logout(req, res);
            return res.json({ ok: true });
        } catch (e) {
            return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 下面开始都需要鉴权
    router.use(adminAuth.authMiddleware);

    // 插件清单（给后台 UI 动态生成页面用）
    router.get('/plugins/manifests', (req, res) => {
        try {
            const manifests = pluginManager.getManifests ? pluginManager.getManifests() : [];
            const projectRoot = process.cwd();
            const data = manifests.map((manifest) => ({
                manifest,
                source: readManifestSource(projectRoot, manifest),
            }));
            res.json({ ok: true, data });
        } catch (e) {
            res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    router.get('/cards', (req, res) => {
        try {
            const data = getAdminCards(pluginManager, {
                placement: req.query && req.query.placement,
                plugin: req.query && req.query.plugin,
            });
            res.json({ ok: true, data });
        } catch (e) {
            res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 插件管理（启用/禁用/安装）
    const { createAdminPluginsRouter } = require('./adminPluginsApi');
    router.use('/plugins', createAdminPluginsRouter(process.cwd(), pluginManager, config));

    // 插件 README（仅管理员）
    const { createAdminPluginsReadmeRouter } = require('./adminPluginsReadmeApi');
    router.use('/plugins', createAdminPluginsReadmeRouter(process.cwd()));

    // 性能指标（仅管理员）
    router.get('/metrics/overview', (req, res) => {
        try {
            const metrics = require('./metrics');
            const windowSecondsRaw = req.query && req.query.window ? String(req.query.window) : '300';
            const windowSeconds = Math.max(10, Math.min(3600, parseInt(windowSecondsRaw, 10) || 300));
            res.json(metrics.getOverview({ windowSeconds }));
        } catch (e) {
            res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 通用数据管理（CRUD）
    const { createAdminDataRouter } = require('./adminDataApi');
    router.use('/data', createAdminDataRouter(process.cwd()));

    // 资源级概览卡片配置（data/[plugin]/[resource] 页面用）
    const { createAdminDataOverviewRouter } = require('./adminDataOverviewApi');
    router.use('/data', createAdminDataOverviewRouter(process.cwd()));

    // 数据资源清单（入口页使用）
    const { createAdminDataResourcesRouter } = require('./adminDataResourcesApi');
    router.use('/data', createAdminDataResourcesRouter(process.cwd(), pluginManager));

    return router;
}

module.exports = {
    createAdminApiRouter
};
