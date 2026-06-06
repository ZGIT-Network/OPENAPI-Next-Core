const express = require('express');
const { findPluginManifest, getAdminResourcesFromManifest } = require('./pluginManifestStore');

function createAdminDataOverviewRouter(projectRoot) {
  const router = express.Router();

  router.get('/:plugin/:resource/overview', (req, res) => {
    try {
      const pluginName = String(req.params.plugin || '');
      const resourceId = String(req.params.resource || '');

      const manifest = findPluginManifest(projectRoot, pluginName);
      if (!manifest) return res.status(404).json({ ok: false, error: 'manifest not found' });

      const resources = getAdminResourcesFromManifest(manifest);
      const resource = resources.find(r => r && r.id === resourceId);
      if (!resource) return res.status(404).json({ ok: false, error: 'resource not found' });

      const overview = resource.overview && typeof resource.overview === 'object' ? resource.overview : null;
      const cards = overview && Array.isArray(overview.cards) ? overview.cards : [];

      // 不在后端代请求 endpoint；这里只负责把配置发给前端
      res.json({ ok: true, data: { cards } });
    } catch (e) {
      res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  });

  return router;
}

module.exports = {
  createAdminDataOverviewRouter,
};
