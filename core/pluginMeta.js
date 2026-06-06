const fs = require('fs');
const path = require('path');

function getMetaPath(projectRoot) {
    return path.join(projectRoot, 'core', 'pluginMeta.json');
}

function readMeta(projectRoot) {
    const p = getMetaPath(projectRoot);
    try {
        if (!fs.existsSync(p)) return {};
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (!data || typeof data !== 'object') return {};
        return data;
    } catch {
        return {};
    }
}

function writeMeta(projectRoot, meta) {
    const p = getMetaPath(projectRoot);
    fs.writeFileSync(p, JSON.stringify(meta || {}, null, 2));
}

function upsertPluginMeta(projectRoot, pluginName, patch) {
    const meta = readMeta(projectRoot);
    const cur = meta[pluginName] && typeof meta[pluginName] === 'object' ? meta[pluginName] : {};
    meta[pluginName] = {
        ...cur,
        ...patch,
        updatedAt: Date.now(),
    };
    writeMeta(projectRoot, meta);
    return meta[pluginName];
}

function getPluginMeta(projectRoot, pluginName) {
    const meta = readMeta(projectRoot);
    return meta[pluginName] || null;
}

module.exports = {
    getMetaPath,
    readMeta,
    writeMeta,
    upsertPluginMeta,
    getPluginMeta,
};
