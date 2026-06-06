function parseHosts(value) {
    if (!value) return [];
    return String(value)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

function getAdminInstallAllowedHosts(config) {
    const hosts = parseHosts(config && config.admin ? config.admin.installAllowedHosts : '');
    return hosts.map(h => h.toLowerCase());
}

module.exports = {
    getAdminInstallAllowedHosts
};
