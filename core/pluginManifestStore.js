const fs = require('fs');
const path = require('path');

function safeReadJSON(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function findPluginManifest(projectRoot, pluginName) {
  const apisDir = path.join(projectRoot, 'apis');

  // dir plugin (enabled)
  const dirManifest = path.join(apisDir, pluginName, 'manifest.json');
  // dir plugin (disabled)
  const dirManifestDisabled = path.join(apisDir, `${pluginName}.disabled`, 'manifest.json');
  // file plugin side manifest
  const fileManifest = path.join(apisDir, `${pluginName}.manifest.json`);

  const m = safeReadJSON(dirManifest) || safeReadJSON(dirManifestDisabled) || safeReadJSON(fileManifest);
  return m;
}

function getAdminResourcesFromManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return [];
  const admin = manifest.admin;
  if (!admin || typeof admin !== 'object') return [];
  const resources = admin.resources;
  if (!Array.isArray(resources)) return [];
  return resources;
}

module.exports = {
  findPluginManifest,
  getAdminResourcesFromManifest,
};
