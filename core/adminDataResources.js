const { findPluginManifest, getAdminResourcesFromManifest } = require('./pluginManifestStore');

function listDataResources(projectRoot, pluginManager) {
  const manifests = pluginManager && pluginManager.getManifests ? pluginManager.getManifests() : [];
  const out = [];

  for (const m of manifests) {
    if (!m || typeof m !== 'object') continue;
    const pluginName = m.name;
    if (!pluginName) continue;

    // 直接从已加载的 manifest 里取 admin.resources
    const resources = getAdminResourcesFromManifest(m);
    if (resources.length) {
      out.push({
        plugin: pluginName,
        title: m.title || pluginName,
        resources: resources.map(r => ({
          id: r.id,
          title: r.title || r.id,
          permissions: r.permissions || [],
          primaryKey: r.primaryKey || 'id',
          table: r.table,
          fields: r.fields || {},
        }))
      });
      continue;
    }

    // 兼容：如果 manifest 没进 getManifests（极端情况），再从磁盘查一次
    const diskManifest = findPluginManifest(projectRoot, pluginName);
    const diskResources = getAdminResourcesFromManifest(diskManifest);
    if (diskResources.length) {
      out.push({
        plugin: pluginName,
        title: (diskManifest && (diskManifest.title || diskManifest.name)) || pluginName,
        resources: diskResources.map(r => ({
          id: r.id,
          title: r.title || r.id,
          permissions: r.permissions || [],
          primaryKey: r.primaryKey || 'id',
          table: r.table,
          fields: r.fields || {},
        }))
      });
    }
  }

  return out;
}

module.exports = {
  listDataResources,
};
