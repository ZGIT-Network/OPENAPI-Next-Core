const fs = require('fs');
const path = require('path');
console.log("+ [PluginManager] 初始化插件注册表");
function getRegistryPath(projectRoot) {
    return path.join(projectRoot, 'core', 'pluginRegistry.json');
}

function readRegistry(projectRoot) {
    const p = getRegistryPath(projectRoot);
    try {
        if (!fs.existsSync(p)) {
            return { disabled: [] };
        }
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (!data || typeof data !== 'object') return { disabled: [] };
        if (!Array.isArray(data.disabled)) data.disabled = [];
        return data;
    } catch (e) {
        return { disabled: [] };
    }
}

function writeRegistry(projectRoot, registry) {
    const p = getRegistryPath(projectRoot);
    const safe = {
        disabled: Array.isArray(registry.disabled) ? registry.disabled : []
    };
    fs.writeFileSync(p, JSON.stringify(safe, null, 2));
}

function isDisabled(projectRoot, pluginName) {
    const reg = readRegistry(projectRoot);
    return reg.disabled.includes(pluginName);
}

function setDisabled(projectRoot, pluginName, disabled) {
    const reg = readRegistry(projectRoot);
    const set = new Set(reg.disabled);
    if (disabled) set.add(pluginName);
    else set.delete(pluginName);
    reg.disabled = Array.from(set);
    writeRegistry(projectRoot, reg);
}

module.exports = {
    readRegistry,
    writeRegistry,
    isDisabled,
    setDisabled,
    getRegistryPath
};
