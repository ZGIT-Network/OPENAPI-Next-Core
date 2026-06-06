const crypto = require('crypto');
const NodeCache = require('node-cache');
console.log("+ [AdminAuth] 初始化管理员认证模块");

const ADMIN_SESSION_COOKIE = 'openapi_admin_session';

function parseCookies(req) {
    const raw = req && req.headers ? req.headers.cookie : '';
    if (!raw || typeof raw !== 'string') return {};

    const out = {};
    raw.split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx <= 0) return;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) return;
        try {
            out[key] = decodeURIComponent(value);
        } catch {
            out[key] = value;
        }
    });
    return out;
}

function createAdminAuth(config) {
    const adminConfig = (config && config.admin) ? config.admin : {};

    const enabled = adminConfig.enable !== false;
    const adminKey = adminConfig.key || '';
    const ttlSeconds = Number(adminConfig.tokenTtlSeconds || 7200);
    const sameSite = String(adminConfig.cookieSameSite || 'lax').toLowerCase();
    const secureCookie = adminConfig.cookieSecure === true;
    const loginMaxAttempts = Math.max(1, Number(adminConfig.loginMaxAttempts || 8));
    const loginWindowSeconds = Math.max(10, Number(adminConfig.loginWindowSeconds || 300));
    const loginBanSeconds = Math.max(30, Number(adminConfig.loginBanSeconds || 900));

    const cache = new NodeCache({ stdTTL: ttlSeconds });
    const loginAttempts = new Map();

    const cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [ip, record] of loginAttempts) {
            const windowExpired = now - record.firstAt > loginWindowSeconds * 1000;
            const banExpired = !record.bannedUntil || record.bannedUntil <= now;
            if (windowExpired && banExpired) {
                loginAttempts.delete(ip);
            }
        }
    }, 10 * 60 * 1000);
    if (cleanupTimer.unref) cleanupTimer.unref();

    function normalizeClientIp(ip) {
        const value = String(ip || '').split(',')[0].trim();
        if (value === '::1') return '127.0.0.1';
        if (value.startsWith('::ffff:')) return value.slice('::ffff:'.length);
        return value || 'unknown';
    }

    function getClientIp(req) {
        return normalizeClientIp(
            (req && req.ip) ||
            (req && req.socket && req.socket.remoteAddress) ||
            (req && req.connection && req.connection.remoteAddress)
        );
    }

    function checkLoginRateLimit(req) {
        const ip = getClientIp(req);
        const now = Date.now();
        let record = loginAttempts.get(ip);

        if (!record || now - record.firstAt > loginWindowSeconds * 1000) {
            record = { firstAt: now, failed: 0, bannedUntil: 0 };
            loginAttempts.set(ip, record);
        }

        if (record.bannedUntil && record.bannedUntil > now) {
            return {
                ok: false,
                ip,
                retryAfterSeconds: Math.ceil((record.bannedUntil - now) / 1000),
            };
        }

        return { ok: true, ip };
    }

    function recordLoginFailure(ip) {
        const now = Date.now();
        let record = loginAttempts.get(ip);
        if (!record || now - record.firstAt > loginWindowSeconds * 1000) {
            record = { firstAt: now, failed: 0, bannedUntil: 0 };
            loginAttempts.set(ip, record);
        }

        record.failed += 1;
        if (record.failed >= loginMaxAttempts) {
            record.bannedUntil = now + loginBanSeconds * 1000;
        }

        return record;
    }

    function clearLoginFailures(ip) {
        loginAttempts.delete(ip);
    }

    function issueToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    function isEnabled() {
        return enabled;
    }

    function login(key, req) {
        if (!enabled) {
            return { ok: false, error: 'admin disabled' };
        }

        const rate = checkLoginRateLimit(req);
        if (!rate.ok) {
            return {
                ok: false,
                status: 429,
                error: 'too many login attempts',
                retryAfterSeconds: rate.retryAfterSeconds,
            };
        }

        if (!adminKey || adminKey === 'PLEASE_CHANGE_ME') {
            return { ok: false, error: 'admin key not configured' };
        }
        if (!key || key !== adminKey) {
            recordLoginFailure(rate.ip);
            return { ok: false, error: 'invalid key' };
        }

        clearLoginFailures(rate.ip);
        const token = issueToken();
        cache.set(token, { createdAt: Date.now() });
        return { ok: true, token, ttlSeconds };
    }

    function verifyToken(token) {
        if (!enabled) return false;
        if (!token) return false;
        return !!cache.get(token);
    }

    function getRequestToken(req) {
        const authHeader = req.headers['authorization'] || '';
        const m = /^Bearer\s+(.+)$/.exec(authHeader);
        if (m && m[1]) return m[1];

        const cookies = parseCookies(req);
        return cookies[ADMIN_SESSION_COOKIE] || null;
    }

    function setSessionCookie(res, token) {
        const attrs = [
            `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
            'Path=/',
            'HttpOnly',
            `Max-Age=${ttlSeconds}`,
            `SameSite=${sameSite === 'strict' ? 'Strict' : sameSite === 'none' ? 'None' : 'Lax'}`,
        ];

        if (secureCookie || sameSite === 'none') {
            attrs.push('Secure');
        }

        res.setHeader('Set-Cookie', attrs.join('; '));
    }

    function clearSessionCookie(res) {
        const attrs = [
            `${ADMIN_SESSION_COOKIE}=`,
            'Path=/',
            'HttpOnly',
            'Max-Age=0',
            'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
            `SameSite=${sameSite === 'strict' ? 'Strict' : sameSite === 'none' ? 'None' : 'Lax'}`,
        ];

        if (secureCookie || sameSite === 'none') {
            attrs.push('Secure');
        }

        res.setHeader('Set-Cookie', attrs.join('; '));
    }

    function logout(req, res) {
        const token = getRequestToken(req);
        if (token) {
            cache.del(token);
        }
        clearSessionCookie(res);
        return { ok: true };
    }

    function getSession(req) {
        const token = getRequestToken(req);
        if (!verifyToken(token)) {
            return { ok: false, authenticated: false };
        }

        return {
            ok: true,
            authenticated: true,
            ttlSeconds,
            actor: token.substring(0, 8),
        };
    }

    function getRequestActor(req) {
        const token = getRequestToken(req);
        if (!verifyToken(token)) return null;
        return token.substring(0, 8);
    }

    function authMiddleware(req, res, next) {
        if (!enabled) {
            return res.status(404).json({ ok: false, error: 'not found' });
        }

        const token = getRequestToken(req);

        if (!verifyToken(token)) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }

        req.adminSession = {
            token,
            actor: token.substring(0, 8),
        };

        next();
    }

    return {
        isEnabled,
        login,
        logout,
        getSession,
        getRequestToken,
        getRequestActor,
        setSessionCookie,
        clearSessionCookie,
        verifyToken,
        authMiddleware,
        cookieName: ADMIN_SESSION_COOKIE,
    };
}

module.exports = {
    createAdminAuth
};
