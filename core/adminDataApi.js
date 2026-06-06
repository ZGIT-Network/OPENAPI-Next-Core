const express = require('express');
const db = require('./database');
const { findPluginManifest, getAdminResourcesFromManifest } = require('./pluginManifestStore');
const { upsertPluginMeta } = require('./pluginMeta');

function tokenFingerprint(req) {
  if (req && req.adminSession && req.adminSession.actor) {
    return req.adminSession.actor;
  }
  return null;
}

function assertSafeIdentifier(v) {
  if (!v || typeof v !== 'string') throw new Error('invalid identifier');
  if (!/^[a-zA-Z0-9_]+$/.test(v)) throw new Error('invalid identifier');
  return v;
}

function getResourceDef(projectRoot, pluginName, resourceId) {
  const manifest = findPluginManifest(projectRoot, pluginName);
  if (!manifest) throw new Error('manifest not found');
  const resources = getAdminResourcesFromManifest(manifest);
  const res = resources.find(r => r && r.id === resourceId);
  if (!res) throw new Error('resource not found');

  const table = assertSafeIdentifier(String(res.table || ''));
  const primaryKey = assertSafeIdentifier(String(res.primaryKey || 'id'));
  const permissions = Array.isArray(res.permissions) ? res.permissions.map(String) : [];
  const fields = res.fields && typeof res.fields === 'object' ? res.fields : {};

  const writableFields = Object.keys(fields).filter(k => {
    const f = fields[k];
    if (!f || typeof f !== 'object') return false;
    if (f.readonly) return false;
    if (k === primaryKey) return false;
    return /^[a-zA-Z0-9_]+$/.test(k);
  });

  const readableFields = Object.keys(fields).filter(k => /^[a-zA-Z0-9_]+$/.test(k));

  return {
    manifest,
    resource: res,
    table,
    primaryKey,
    permissions,
    fields,
    writableFields,
    readableFields,
  };
}

function pickAllowed(obj, allowedKeys) {
  const out = {};
  for (const k of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = obj[k];
    }
  }
  return out;
}

function createAdminDataRouter(projectRoot) {
  const router = express.Router();

  router.use(express.json({ limit: '256kb' }));

  // list
  router.get('/:plugin/:resource', async (req, res) => {
    try {
      const pluginName = String(req.params.plugin);
      const resourceId = String(req.params.resource);
      const def = getResourceDef(projectRoot, pluginName, resourceId);
      if (!def.permissions.includes('list')) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }

      const limitRaw = Number(req.query.limit ?? 50);
      const offsetRaw = Number(req.query.offset ?? 0);
      const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 50));
      const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

      const fieldsSql = def.readableFields.length
        ? def.readableFields.map(f => `\`${f}\``).join(',')
        : `\`${def.primaryKey}\``;

      const rows = await db.query(
        `SELECT ${fieldsSql} FROM \`${def.table}\` ORDER BY \`${def.primaryKey}\` DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      res.json({ ok: true, data: rows, paging: { limit, offset } });
    } catch (e) {
      res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  });

  // create
  router.post('/:plugin/:resource', async (req, res) => {
    try {
      const pluginName = String(req.params.plugin);
      const resourceId = String(req.params.resource);
      const def = getResourceDef(projectRoot, pluginName, resourceId);
      if (!def.permissions.includes('create')) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const data = pickAllowed(body, def.writableFields);
      const keys = Object.keys(data);
      if (!keys.length) throw new Error('no writable fields');

      const cols = keys.map(k => `\`${k}\``).join(',');
      const qs = keys.map(() => '?').join(',');
      const vals = keys.map(k => data[k]);

      const result = await db.query(
        `INSERT INTO \`${def.table}\` (${cols}) VALUES (${qs})`,
        vals
      );

      upsertPluginMeta(projectRoot, pluginName, {
        lastAction: 'data-create',
        lastActionAt: Date.now(),
        operator: tokenFingerprint(req),
      });

      res.json({ ok: true, insertId: result.insertId });
    } catch (e) {
      res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  });

  // update
  router.put('/:plugin/:resource/:id', async (req, res) => {
    try {
      const pluginName = String(req.params.plugin);
      const resourceId = String(req.params.resource);
      const id = String(req.params.id);
      const def = getResourceDef(projectRoot, pluginName, resourceId);
      if (!def.permissions.includes('update')) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const data = pickAllowed(body, def.writableFields);
      const keys = Object.keys(data);
      if (!keys.length) throw new Error('no writable fields');

      const setSql = keys.map(k => `\`${k}\` = ?`).join(',');
      const vals = keys.map(k => data[k]);
      vals.push(id);

      const result = await db.query(
        `UPDATE \`${def.table}\` SET ${setSql} WHERE \`${def.primaryKey}\` = ?`,
        vals
      );

      upsertPluginMeta(projectRoot, pluginName, {
        lastAction: 'data-update',
        lastActionAt: Date.now(),
        operator: tokenFingerprint(req),
      });

      res.json({ ok: true, affectedRows: result.affectedRows });
    } catch (e) {
      res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  });

  // delete (require confirm)
  router.delete('/:plugin/:resource/:id', async (req, res) => {
    try {
      const pluginName = String(req.params.plugin);
      const resourceId = String(req.params.resource);
      const id = String(req.params.id);
      const def = getResourceDef(projectRoot, pluginName, resourceId);
      if (!def.permissions.includes('delete')) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }

      const confirm = String(req.query.confirm || '') === 'true' || String(req.headers['x-confirm-delete'] || '') === 'true';
      if (!confirm) {
        return res.status(400).json({ ok: false, error: 'delete not confirmed' });
      }

      const result = await db.query(
        `DELETE FROM \`${def.table}\` WHERE \`${def.primaryKey}\` = ?`,
        [id]
      );

      upsertPluginMeta(projectRoot, pluginName, {
        lastAction: 'data-delete',
        lastActionAt: Date.now(),
        operator: tokenFingerprint(req),
      });

      res.json({ ok: true, affectedRows: result.affectedRows });
    } catch (e) {
      res.status(400).json({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  });

  return router;
}

module.exports = {
  createAdminDataRouter,
};
