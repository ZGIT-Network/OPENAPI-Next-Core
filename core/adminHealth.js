const axios = require('axios');

function normalizePath(p) {
    if (!p) return null;
    const s = String(p).trim();
    if (!s) return null;
    return s.startsWith('/') ? s : `/${s}`;
}

function isLikelyHtml(payload) {
    if (typeof payload !== 'string') return false;
    const s = payload.trim().toLowerCase();
    return s.startsWith('<!doctype html') || s.startsWith('<html');
}

async function checkHealth({ baseUrl, pluginName, healthPath }) {
    const p = normalizePath(healthPath) || `/${pluginName}/health`;
    const url = `${baseUrl}${p}`;

    const start = Date.now();
    try {
        const resp = await axios.get(url, {
            timeout: 6000,
            validateStatus: () => true,
            headers: {
                'Accept': 'application/json,text/plain,*/*'
            }
        });

        const elapsedMs = Date.now() - start;
        const contentType = String(resp.headers && resp.headers['content-type'] ? resp.headers['content-type'] : '');

        const preview = typeof resp.data === 'string' ? resp.data.slice(0, 1500) : resp.data;
        const htmlFallback = isLikelyHtml(resp.data);

        const okStatus = resp.status >= 200 && resp.status < 300;
        // 如果返回的是典型的 Express 404 HTML 页面，直接判定为“未实现健康检查”
        const ok = okStatus && !htmlFallback;

        return {
            ok,
            status: resp.status,
            elapsedMs,
            url,
            contentType,
            htmlFallback,
            dataPreview: preview,
            hint: !okStatus ? 'non-2xx' : (htmlFallback ? 'html-response' : undefined)
        };
    } catch (e) {
        const elapsedMs = Date.now() - start;
        return {
            ok: false,
            status: 0,
            elapsedMs,
            url,
            error: e && e.message ? e.message : String(e),
        };
    }
}

module.exports = {
    checkHealth,
};
