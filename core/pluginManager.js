const fs = require('fs');
const path = require('path');
const pluginRegistry = require('./pluginRegistry');

let loadedModules = {};
let loadedManifests = [];
let _app;
let _apisDir;
let _projectRoot;

function init(app, projectRoot) {
    _app = app;
    _projectRoot = projectRoot;
    _apisDir = path.join(projectRoot, 'apis');
}

function safeReadJSON(jsonPath) {
    try {
        if (!fs.existsSync(jsonPath)) return null;
        return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch (e) {
        console.log(`! [PlugManager] 读取 JSON 失败: ${jsonPath} | ${e.message}`);
        return null;
    }
}

function normalizeManifest(manifest, pluginName) {
    if (!manifest || typeof manifest !== 'object') return null;
    if (!manifest.name) manifest.name = pluginName;
    return manifest;
}

function resetState() {
    loadedManifests = [];
}

function addManifest(manifest) {
    if (!manifest) return;
    const existing = loadedManifests.find(m => m && m.name === manifest.name);
    if (!existing) {
        loadedManifests.push(manifest);
    }
}

function addPlugin(plugins, plugin) {
    if (!plugin || !plugin.name) return;
    // 同名插件优先保留“未物理禁用”的那个
    const existing = plugins.get(plugin.name);
    if (!existing) {
        plugins.set(plugin.name, plugin);
        return;
    }
    if (existing.physicallyDisabled && !plugin.physicallyDisabled) {
        plugins.set(plugin.name, plugin);
    }
}

function listAllPlugins() {
    if (!_apisDir || !fs.existsSync(_apisDir)) return [];

    const entries = fs.readdirSync(_apisDir);
    const plugins = new Map();

    entries.forEach(entry => {
        const fullPath = path.join(_apisDir, entry);
        const stat = fs.lstatSync(fullPath);

        // 目录型插件
        if (stat.isDirectory()) {
            let name = entry;
            let physicallyDisabled = false;

            if (name.endsWith('.disabled')) {
                physicallyDisabled = true;
                name = name.substring(0, name.length - '.disabled'.length);
            }

            const enabled = !physicallyDisabled && !pluginRegistry.isDisabled(_projectRoot, name);
            const dirForManifest = fullPath; // 如果是 disabled 目录，这里仍能读取 manifest
            const hasManifest = fs.existsSync(path.join(dirForManifest, 'manifest.json'));
            const generation = hasManifest ? 'Next' : undefined;

            addPlugin(plugins, {
                name,
                type: 'dir',
                enabled,
                hasManifest,
                generation,
                physicallyDisabled,
                disabledMode: physicallyDisabled ? 'physical' : (enabled ? null : 'registry')
            });
            return;
        }

        // 单文件插件
        if (stat.isFile()) {
            // 正常 js
            if (entry.endsWith('.js')) {
                const name = entry.substring(0, entry.length - 3);
                const physicallyDisabled = false;
                const enabled = !pluginRegistry.isDisabled(_projectRoot, name);
                const hasManifest = fs.existsSync(path.join(_apisDir, `${name}.manifest.json`));

                addPlugin(plugins, {
                    name,
                    type: 'file',
                    enabled,
                    hasManifest,
                    generation: 'Legacy',
                    physicallyDisabled,
                    disabledMode: enabled ? null : 'registry'
                });
                return;
            }

            // 物理禁用 js：*.js.disabled
            if (entry.endsWith('.js.disabled')) {
                const name = entry.substring(0, entry.length - '.js.disabled'.length);
                const physicallyDisabled = true;
                const enabled = false;
                const hasManifest = fs.existsSync(path.join(_apisDir, `${name}.manifest.json`));

                addPlugin(plugins, {
                    name,
                    type: 'file',
                    enabled,
                    hasManifest,
                    generation: 'Legacy',
                    physicallyDisabled,
                    disabledMode: 'physical'
                });
                return;
            }
        }
    });

    return Array.from(plugins.values());
}

function loadRoutes() {
    if (!_app || !_apisDir) throw new Error('PluginManager not initialized');
    resetState();

    const allPlugins = listAllPlugins();
    allPlugins.forEach(p => {
        if (!p.enabled) return;

        if (p.type === 'dir') {
            const fullPath = path.join(_apisDir, p.name);
            const entryFile = path.join(fullPath, 'index.js');
            const manifestFile = path.join(fullPath, 'manifest.json');

            if (fs.existsSync(entryFile) && !loadedModules[entryFile]) {
                console.log(`~ [PlugManager] 载入模块: ${entryFile}`);
                const api = require(entryFile);
                _app.use(`/${p.name}`, api);
                loadedModules[entryFile] = { router: _app._router.stack[_app._router.stack.length - 1] };
            }

            const manifest = normalizeManifest(safeReadJSON(manifestFile), p.name);
            if (manifest) addManifest(manifest);

        } else if (p.type === 'file') {
            const fullPath = path.join(_apisDir, `${p.name}.js`);
            const manifestFile = path.join(_apisDir, `${p.name}.manifest.json`);

            if (fs.existsSync(fullPath) && !loadedModules[fullPath]) {
                console.log(`~ [PlugManager] 载入模块: ${fullPath}`);
                const api = require(fullPath);
                _app.use(`/${p.name}`, api);
                loadedModules[fullPath] = { router: _app._router.stack[_app._router.stack.length - 1] };
            }

            const manifest = normalizeManifest(safeReadJSON(manifestFile), p.name);
            if (manifest) addManifest(manifest);
        }
    });
}

function unloadAllRoutes() {
    const routes = _app._router.stack;
    const modulePaths = Object.keys(loadedModules);

    modulePaths.forEach(p => {
        const moduleInfo = loadedModules[p];
        if (moduleInfo && moduleInfo.router) {
            const index = routes.indexOf(moduleInfo.router);
            if (index > -1) routes.splice(index, 1);
        }
        delete require.cache[require.resolve(p)];
    });

    loadedModules = {};
    console.log(`- [PlugManager] 已卸载所有模块`);
}

function reloadAllPlugins() {
    unloadAllRoutes();
    loadRoutes();
}

function getManifests() {
    return [...loadedManifests];
}

module.exports = {
    init,
    loadRoutes,
    reloadAllPlugins,
    listAllPlugins,
    getManifests
};
