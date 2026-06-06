const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AdmZip = require('adm-zip');

const pluginRegistry = require('./pluginRegistry');
const installer = require('./pluginInstaller');

const axios = require('axios');
const { getAdminInstallAllowedHosts } = require('./adminConfig');

const { upsertPluginMeta, getPluginMeta } = require('./pluginMeta');
const { checkHealth } = require('./adminHealth');
const { isPhysicallyDisabled, physicalDisable, physicalEnable } = require('./pluginFsDisable');

function tokenFingerprint(req) {
    if (req && req.adminSession && req.adminSession.actor) {
        return req.adminSession.actor;
    }
    return null;
}

function createAdminPluginsRouter(projectRoot, pluginManager, config) {
    const router = express.Router();

    const apisDir = path.join(projectRoot, 'apis');

    function assertPluginName(name) {
        const n = installer.safeName(name);
        if (!n) throw new Error('invalid plugin name');
        return n;
    }

    function pluginExists(name) {
        const dirPath = path.join(apisDir, name);
        const filePath = path.join(apisDir, `${name}.js`);
        return fs.existsSync(dirPath) || fs.existsSync(filePath);
    }

    function reload() {
        if (pluginManager && pluginManager.reloadAllPlugins) {
            pluginManager.reloadAllPlugins();
        }
    }

    // 插件详情
    router.get('/:name', (req, res) => {
        try {
            const { getPluginDetail } = require('./adminPluginsDetail');
            const name = assertPluginName(req.params.name);
            const detail = getPluginDetail(projectRoot, name);
            if (!detail) {
                return res.status(404).json({ ok: false, error: 'plugin not found' });
            }

            const meta = getPluginMeta(projectRoot, name);
            const physicallyDisabled = isPhysicallyDisabled(apisDir, name);
            res.json({ ok: true, data: { ...detail, meta, physicallyDisabled } });
        } catch (e) {
            res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 插件列表
    router.get('/', (req, res) => {
        try {
            const list = pluginManager.listAllPlugins ? pluginManager.listAllPlugins() : [];

            function safeReadJSON(p) {
                try {
                    if (!fs.existsSync(p)) return null;
                    return JSON.parse(fs.readFileSync(p, 'utf-8'));
                } catch {
                    return null;
                }
            }

            function getNextPluginManifest(name) {
                return safeReadJSON(path.join(apisDir, name, 'manifest.json'))
                    || safeReadJSON(path.join(apisDir, `${name}.disabled`, 'manifest.json'));
            }

            const enriched = list.map(p => {
                const m = p.generation === 'Next' ? getNextPluginManifest(p.name) : null;
                return {
                ...p,
                    pluginVersion: m && typeof m === 'object' && m.version ? String(m.version) : null,
                    pluginAuthor: m && typeof m === 'object' && m.author ? String(m.author) : null,
                    pluginType: m && typeof m === 'object' && m.type ? String(m.type) : null,
                physicallyDisabled: isPhysicallyDisabled(apisDir, p.name)
                };
            });
            res.json({ ok: true, data: enriched });
        } catch (e) {
            res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 启用
    router.post('/:name/enable', (req, res) => {
        try {
            const name = assertPluginName(req.params.name);
            if (!pluginExists(name)) return res.status(404).json({ ok: false, error: 'plugin not found' });

            pluginRegistry.setDisabled(projectRoot, name, false);
            upsertPluginMeta(projectRoot, name, {
                lastAction: 'enable',
                lastActionAt: Date.now(),
                operator: tokenFingerprint(req),
            });

            reload();
            res.json({ ok: true });
        } catch (e) {
            res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 禁用（逻辑禁用：registry）
    router.post('/:name/disable', (req, res) => {
        try {
            const name = assertPluginName(req.params.name);
            if (!pluginExists(name)) return res.status(404).json({ ok: false, error: 'plugin not found' });

            pluginRegistry.setDisabled(projectRoot, name, true);
            upsertPluginMeta(projectRoot, name, {
                lastAction: 'disable',
                lastActionAt: Date.now(),
                operator: tokenFingerprint(req),
            });

            reload();
            res.json({ ok: true });
        } catch (e) {
            res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 物理禁用（重命名为 .disabled）
    router.post('/:name/disable-physical', (req, res) => {
        try {
            const name = assertPluginName(req.params.name);
            // 如果已经物理禁用，直接返回 ok
            if (isPhysicallyDisabled(apisDir, name)) {
                return res.json({ ok: true, already: true });
            }

            physicalDisable(apisDir, name);
            // 同时清理逻辑禁用，避免残留
            pluginRegistry.setDisabled(projectRoot, name, false);

            upsertPluginMeta(projectRoot, name, {
                lastAction: 'disable-physical',
                lastActionAt: Date.now(),
                operator: tokenFingerprint(req),
            });

            reload();
            res.json({ ok: true });
        } catch (e) {
            res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 物理启用（将 .disabled 改回原名）
    router.post('/:name/enable-physical', (req, res) => {
        try {
            const name = assertPluginName(req.params.name);
            if (!isPhysicallyDisabled(apisDir, name)) {
                return res.status(400).json({ ok: false, error: 'plugin not physically disabled' });
            }

            physicalEnable(apisDir, name);

            upsertPluginMeta(projectRoot, name, {
                lastAction: 'enable-physical',
                lastActionAt: Date.now(),
                operator: tokenFingerprint(req),
            });

            reload();
            res.json({ ok: true });
        } catch (e) {
            res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 手动刷新（例如你手动把插件放进 apis 后调用）
    router.post('/refresh', (req, res) => {
        try {
            reload();
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    function getAllowedHosts() {
        return getAdminInstallAllowedHosts(config || global._config || {});
    }

    function assertUrlAllowed(rawUrl) {
        let u;
        try {
            u = new URL(rawUrl);
        } catch {
            throw new Error('invalid url');
        }

        if (u.protocol !== 'https:') {
            throw new Error('only https is allowed');
        }

        const hostname = (u.hostname || '').toLowerCase();
        const allowed = getAllowedHosts();
        if (!allowed.length) {
            throw new Error('installAllowedHosts not configured');
        }
        if (!allowed.includes(hostname)) {
            throw new Error('hostname not allowed');
        }

        return u;
    }

    // 上传 zip 安装
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 20 * 1024 * 1024 } // 20MB
    });

    function removePluginTarget(pluginName) {
        const dirPath = path.join(apisDir, pluginName);
        const filePath = path.join(apisDir, `${pluginName}.js`);
        const fileManifestPath = path.join(apisDir, `${pluginName}.manifest.json`);

        if (fs.existsSync(dirPath)) {
            if (!installer.isWithinDir(apisDir, dirPath)) throw new Error('illegal path');
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
        if (fs.existsSync(filePath)) {
            if (!installer.isWithinDir(apisDir, filePath)) throw new Error('illegal path');
            fs.rmSync(filePath, { force: true });
        }
        if (fs.existsSync(fileManifestPath)) {
            if (!installer.isWithinDir(apisDir, fileManifestPath)) throw new Error('illegal path');
            fs.rmSync(fileManifestPath, { force: true });
        }
    }

    function installZipBuffer(zipBuffer, providedPluginName, options = {}) {
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries();

        // 支持两种包结构：
        // 1) <pluginName>/...(推荐)
        // 2) 直接包含 index.js/manifest.json（需要 providedPluginName）
        let rootFolders = new Set();
        entries.forEach(e => {
            const p = e.entryName.replace(/\\/g, '/');
            const first = p.split('/')[0];
            if (first) rootFolders.add(first);
        });

        let pluginName = providedPluginName ? String(providedPluginName) : null;
        if (!pluginName && rootFolders.size === 1) {
            pluginName = Array.from(rootFolders)[0];
        }
        pluginName = assertPluginName(pluginName);

        const targetDir = path.join(apisDir, pluginName);
        if (pluginExists(pluginName)) {
            if (!options.update) {
                throw new Error('plugin already exists; enable update to overwrite');
            }
            removePluginTarget(pluginName);
        }
        installer.ensureDir(targetDir);

        // 白名单扩展名
        const allowExt = new Set(['.js', '.json', '.css', '.html', '.png', '.jpg', '.jpeg', '.svg', '.txt', '.md']);

        for (const e of entries) {
            if (e.isDirectory) continue;
            const entryName = e.entryName.replace(/\\/g, '/');

            // 只允许写入 pluginName 子目录
            let rel = entryName;
            if (rel.startsWith(`${pluginName}/`)) {
                rel = rel.substring(pluginName.length + 1);
            }

            if (!rel || rel.includes('..') || rel.startsWith('/')) {
                throw new Error('illegal zip entry');
            }

            const ext = path.extname(rel).toLowerCase();
            if (!allowExt.has(ext)) {
                throw new Error(`disallowed file type: ${ext}`);
            }

            installer.writeFileSafe(targetDir, rel, e.getData());
        }

        // 安装完成后默认启用
        pluginRegistry.setDisabled(projectRoot, pluginName, false);
        reload();

        return pluginName;
    }

    router.post('/install/upload-zip', upload.single('file'), (req, res) => {
        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ ok: false, error: 'missing file' });
            }

            const update = req.body && (req.body.update === true || req.body.update === 'true' || req.body.update === '1');
            const pluginName = installZipBuffer(req.file.buffer, req.body && req.body.pluginName, { update });

            upsertPluginMeta(projectRoot, pluginName, {
                installSource: 'upload',
                installUrl: null,
                installedAt: Date.now(),
                operator: tokenFingerprint(req),
                lastAction: update ? 'update' : 'install',
                lastActionAt: Date.now(),
            });

            res.json({ ok: true, plugin: pluginName, updated: update });
        } catch (e) {
            res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 从 URL 安装（仅允许 config.ini 中设置的 hostname）
    router.post('/install/from-url', express.json(), async (req, res) => {
        try {
            const url = req.body && req.body.url ? String(req.body.url) : '';
            const u = assertUrlAllowed(url);

            // 额外限制：最大 20MB
            const resp = await axios.get(u.toString(), {
                responseType: 'arraybuffer',
                timeout: 15000,
                maxContentLength: 20 * 1024 * 1024,
                maxBodyLength: 20 * 1024 * 1024,
                validateStatus: (s) => s >= 200 && s < 300
            });

            const buf = Buffer.from(resp.data);
            // 简单签名校验：ZIP 头 "PK"
            if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
                throw new Error('not a zip file');
            }

            const update = req.body && (req.body.update === true || req.body.update === 'true' || req.body.update === '1');
            const pluginName = installZipBuffer(buf, req.body && req.body.pluginName, { update });

            upsertPluginMeta(projectRoot, pluginName, {
                installSource: 'url',
                installUrl: u.toString(),
                installedAt: Date.now(),
                operator: tokenFingerprint(req),
                lastAction: update ? 'update' : 'install',
                lastActionAt: Date.now(),
            });

            res.json({ ok: true, plugin: pluginName, updated: update });
        } catch (e) {
            res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 健康检查（仅当 manifest.healthPath 存在时才允许）
    router.post('/:name/health', async (req, res) => {
        try {
            const { getPluginDetail } = require('./adminPluginsDetail');
            const name = assertPluginName(req.params.name);
            const detail = getPluginDetail(projectRoot, name);
            if (!detail) {
                return res.status(404).json({ ok: false, error: 'plugin not found' });
            }

            const healthPath = detail.manifest && detail.manifest.healthPath ? String(detail.manifest.healthPath) : null;
            if (!healthPath) {
                return res.status(400).json({ ok: false, error: 'healthPath not configured' });
            }

            const port = (config && config.app && config.app.port) ? String(config.app.port) : (global._config && global._config.app && global._config.app.port ? String(global._config.app.port) : '3001');
            const baseUrl = `http://127.0.0.1:${port}`;

            const result = await checkHealth({ baseUrl, pluginName: name, healthPath });

            // 仅在启用健康检查时才写入 lastHealth
            upsertPluginMeta(projectRoot, name, {
                lastHealth: { ...result, checkedAt: Date.now() },
                lastAction: 'health',
                lastActionAt: Date.now(),
                operator: tokenFingerprint(req),
            });

            res.json({ ok: true, data: result });
        } catch (e) {
            res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    // 卸载插件（删除文件/目录）
    router.post('/:name/uninstall', (req, res) => {
        try {
            const name = assertPluginName(req.params.name);

            const dirPath = path.join(apisDir, name);
            const filePath = path.join(apisDir, `${name}.js`);
            const fileManifestPath = path.join(apisDir, `${name}.manifest.json`);

            const { isWithinDir, removeDirRecursive, removeFile } = require('./fileUtils');

            if (fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory()) {
                if (!isWithinDir(apisDir, dirPath)) throw new Error('illegal path');
                removeDirRecursive(dirPath);
            } else if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                if (!isWithinDir(apisDir, filePath)) throw new Error('illegal path');
                removeFile(filePath);
                // 同名旁路 manifest 一并删除（若存在）
                if (fs.existsSync(fileManifestPath) && fs.lstatSync(fileManifestPath).isFile()) {
                    if (!isWithinDir(apisDir, fileManifestPath)) throw new Error('illegal path');
                    removeFile(fileManifestPath);
                }
            } else {
                return res.status(404).json({ ok: false, error: 'plugin not found' });
            }

            // 从禁用列表移除，避免残留状态
            pluginRegistry.setDisabled(projectRoot, name, false);
            upsertPluginMeta(projectRoot, name, {
                lastAction: 'uninstall',
                lastActionAt: Date.now(),
                operator: tokenFingerprint(req),
            });

            reload();
            res.json({ ok: true });
        } catch (e) {
            res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
        }
    });

    return router;
}

module.exports = {
    createAdminPluginsRouter
};
