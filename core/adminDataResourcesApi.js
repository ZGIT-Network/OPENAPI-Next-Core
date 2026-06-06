const express = require('express');
const { listDataResources } = require('./adminDataResources');

function createAdminDataResourcesRouter(projectRoot, pluginManager) {
  const router = express.Router();

  router.get('/resources', (req, res) => {
    try {
      const data = listDataResources(projectRoot, pluginManager);
      res.json({ ok: true, data });
    } catch (e) {
      res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  });

  return router;
}

module.exports = {
  createAdminDataResourcesRouter,
};
