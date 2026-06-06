const express = require('express');
console.log("+ [PluginManager] 初始化插件清单API路由");
function createPluginManifestRouter(pluginManager) {
    const router = express.Router();

    router.get('/plugins/manifests', (req, res) => {
        try {
            const manifests = pluginManager.getManifests ? pluginManager.getManifests() : [];
            res.json({
                ok: true,
                data: manifests
            });
        } catch (e) {
            res.status(500).json({
                ok: false,
                error: e && e.message ? e.message : String(e)
            });
        }
    });

    return router;
}

module.exports = {
    createPluginManifestRouter
};
