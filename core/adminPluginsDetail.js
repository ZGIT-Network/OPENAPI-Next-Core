const fs = require('fs');
const path = require('path');
const pluginRegistry = require('./pluginRegistry');

function safeReadJSON(jsonPath) {
  try {
    if (!fs.existsSync(jsonPath)) return null;
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

function listFilesShallow(dirPath, max = 50) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      if (out.length >= max) break;
      out.push({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file'
      });
    }
    return out;
  } catch {
    return [];
  }
}

function getPluginDetail(projectRoot, pluginName) {
  const apisDir = path.join(projectRoot, 'apis');

  const dirPath = path.join(apisDir, pluginName);
  const filePath = path.join(apisDir, `${pluginName}.js`);
  const fileManifestPath = path.join(apisDir, `${pluginName}.manifest.json`);

  const disabled = pluginRegistry.isDisabled(projectRoot, pluginName);

  if (fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory()) {
    const entryFile = path.join(dirPath, 'index.js');
    const manifestFile = path.join(dirPath, 'manifest.json');
    const manifestObj = safeReadJSON(manifestFile);

    return {
      name: pluginName,
      generation: manifestObj ? 'Next' : undefined,
      type: 'dir',
      enabled: !disabled,
      paths: {
        dir: dirPath,
        entry: fs.existsSync(entryFile) ? entryFile : null,
        manifest: fs.existsSync(manifestFile) ? manifestFile : null
      },
      manifest: manifestObj,
      pluginVersion: manifestObj && typeof manifestObj === 'object' && manifestObj.version ? String(manifestObj.version) : null,
      pluginAuthor: manifestObj && typeof manifestObj === 'object' && manifestObj.author ? String(manifestObj.author) : null,
      pluginType: manifestObj && typeof manifestObj === 'object' && manifestObj.type ? String(manifestObj.type) : null,
      files: {
        sample: listFilesShallow(dirPath, 80)
      }
    };
  }

  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
    return {
      name: pluginName,
      generation: 'Legacy',
      type: 'file',
      enabled: !disabled,
      paths: {
        file: filePath,
        manifest: fs.existsSync(fileManifestPath) ? fileManifestPath : null
      },
      manifest: safeReadJSON(fileManifestPath),
      pluginVersion: null,
      pluginAuthor: null,
      pluginType: null,
      files: {
        sample: []
      }
    };
  }

  return null;
}

module.exports = {
  getPluginDetail
};
