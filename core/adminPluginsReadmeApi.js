const express = require('express');
const path = require('path');
const fs = require('fs');
const installer = require('./pluginInstaller');

function createAdminPluginsReadmeRouter(projectRoot) {
  const router = express.Router();
  const apisDir = path.join(projectRoot, 'apis');

  function assertPluginName(name) {
    const n = installer.safeName(name);
    if (!n) throw new Error('invalid plugin name');
    return n;
  }

  router.get('/:name/readme', (req, res) => {
    try {
      const name = assertPluginName(req.params.name);

      // Next 插件：apis/<name>/README.md
      const p1 = path.join(apisDir, name, 'README.md');
      // Legacy 插件：apis/<name>.README.md（可选）
      const p2 = path.join(apisDir, `${name}.README.md`);

      let target = null;
      if (fs.existsSync(p1) && fs.lstatSync(p1).isFile()) target = p1;
      else if (fs.existsSync(p2) && fs.lstatSync(p2).isFile()) target = p2;

      if (!target) return res.status(404).json({ ok: false, error: 'readme not found' });

      const stat = fs.statSync(target);
      const maxBytes = 256 * 1024;
      if (stat.size > maxBytes) {
        return res.status(413).json({ ok: false, error: 'readme too large' });
      }

      const content = fs.readFileSync(target, 'utf-8');
      res.json({ ok: true, data: { content } });
    } catch (e) {
      res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  });

  return router;
}

module.exports = {
  createAdminPluginsReadmeRouter,
};
