"use strict";

// 安全防护中间件（基本 CC 防护、异常访问拦截）
// 通过在内存中记录 IP 访问频率，在达到阈值时临时封禁。
// 策略完全由配置文件 [security] 段控制，避免硬编码。
//
// @param {object} config 从 config.ini 读取的 _config.security 对象，所有字段均为可选。
//   enable        : 是否启用本中间件，默认 true
//   maxRequests   : 允许在 timeWindow 内的最大请求数，默认 100
//   timeWindow    : 统计窗口长度（秒），默认 60
//   banTime       : 触发阈值后封禁时长（秒），默认 600
//   invalidMaxRequests : 允许在 timeWindow 内的无效请求数，默认 20
//   invalidBanTime  : 触发无效请求阈值后封禁时长（秒），默认 900
//   maxBanCount     : 最大封禁次数，默认 5
//   whitelist     : 白名单数组或以逗号分隔的字符串，默认 []
//   invalidCodes  : 无效状态码数组或以逗号分隔的字符串，默认 ["404", "403"]
//   uaBlacklist   : UA 黑名单数组或以逗号分隔的字符串，默认 []
//   refererWhitelist : Referer 白名单前缀数组或以逗号分隔的字符串，默认 []
//   maxPostSizeKB : 允许的最大 POST 大小（KB），默认 1024
//   ipBlacklist   : IP 黑名单数组或以逗号分隔的字符串，默认 []
//   warnBeforeDrop : 在封禁前先返回 419 的次数，默认 3
//

module.exports = function createSecurityMiddleware(config = {}) {
    // 合并默认值
    const {
        enable = true,
        maxRequests = 100,
        timeWindow = 60,
        banTime = 600,
        invalidMaxRequests = 20,
        invalidBanTime = 900,
        maxBanCount = 5,
        whitelist = "",
        invalidCodes = "404,403,413",
        uaBlacklist = "curl,bot,spider",
        refererWhitelist = "",
        maxPostSizeKB = 1024,
        ipBlacklist = "",
        warnBeforeDrop = 30
    } = config;

    

    // 若未启用则直接放行
    if (!enable) {
      
        return (req, res, next) => next();
    } else {
        setTimeout(() => {
        console.log(`~ [Security] 基础安全组件已载入, 若要禁用, 请在配置文件 [security] 中设置 enable = false`);

    // 在非生产环境下输出简要策略，以便调试

        console.log("~ [Security] 安全组件策略:", {
            maxRequests,
            timeWindow,
            banTime,
            invalidMaxRequests,
            invalidBanTime,
            uaBlacklist,
            refererWhitelist,
            maxPostSizeKB,
            ipBlacklist,
            warnBeforeDrop
        }, " 请确保配置正确。");
        }, 3000);
    }



    // 将白名单转换为数组并去除空字符串
    const whitelistSet = new Set(
        (Array.isArray(whitelist) ? whitelist : String(whitelist).split(/[,;\s]+/))
            .map(ip => ip.trim())
            .filter(ip => ip.length)
    );

    // 需要单独检测的无效状态码集合
    const invalidCodesSet = new Set(
        (Array.isArray(invalidCodes) ? invalidCodes : String(invalidCodes).split(/[,;\s]+/))
            .map(code => Number(code.trim()))
            .filter(code => !Number.isNaN(code))
    );

    // UA 黑名单子串集合（小写）
    const uaBlacklistArr = (Array.isArray(uaBlacklist) ? uaBlacklist : String(uaBlacklist).split(/[,;\s]+/))
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

    // Referer 白名单前缀集合
    const refererWhitelistArr = (Array.isArray(refererWhitelist) ? refererWhitelist : String(refererWhitelist).split(/[,;\s]+/))
        .map(s => s.trim())
        .filter(Boolean);

    // IP 黑名单（支持精确 IP 或 CIDR，如 192.168.0.0/24）
    const ipBlacklistArr = (Array.isArray(ipBlacklist) ? ipBlacklist : String(ipBlacklist).split(/[,;\s]+/))
        .map(s => s.trim())
        .filter(Boolean);

    function ipToInt(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    }

    function inCidr(ip, cidr) {
        if (!cidr.includes('/')) {
            return ip === cidr; // 精确匹配
        }
        const [range, bitsStr] = cidr.split('/');
        const bits = parseInt(bitsStr, 10) || 32;
        const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0;
        return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
    }

    // 记录结构：{ count: number, first: timestamp(ms), bannedUntil: timestamp(ms) }
    const ipMap = new Map();

    // 定时清理过期数据，防止内存膨胀
    const CLEAN_INTERVAL = 10 * 60 * 1000; // 10 分钟
    setInterval(() => {
        const now = Date.now();
        for (const [ip, record] of ipMap) {
            if ((record.bannedUntil && record.bannedUntil < now) ||
                (!record.bannedUntil && record.first + timeWindow * 1000 < now)) {
                ipMap.delete(ip);
            }
        }
    }, CLEAN_INTERVAL).unref(); // unref 避免阻止进程退出

    // 模拟 Nginx 444：关闭连接不回包
    function dropConnection(req, res, reason = "") {

        console.warn(`~ [Security] 安全组件阻断异常连接: ${reason}`);
        
        // 尝试写入 444 状态行（部分客户端可能读取不到）
        if (!res.headersSent) {
            try {
                res.writeHead(444);
            } catch (e) {}
        }
        // 立即销毁 socket
        if (req.socket && !req.socket.destroyed) {
            req.socket.destroy();
        }
    }

    function normalizeAdminPanelEntry(raw) {
        const value = String(raw || '/admin').trim();
        if (!value || value === '/') return '/admin';
        let normalized = value.startsWith('/') ? value : `/${value}`;
        normalized = normalized.replace(/\/+$/, '');
        return normalized || '/admin';
    }

    const adminPanelEntry = normalizeAdminPanelEntry(config.adminPanelEntry || config.panelEntry);

    function shouldBypassAdminPanel(req) {
        const path = (req.originalUrl || req.url || '').split('?')[0];
        if (path.startsWith('/admin/api')) return true;
        if (path.startsWith('/_next/')) return true;
        if (path === '/favicon.ico' || path.startsWith('/favicon.ico')) return true;
        if (adminPanelEntry === '/admin') {
            return path === '/admin' || path.startsWith('/admin/');
        }
        return path === adminPanelEntry || path.startsWith(`${adminPanelEntry}/`);
    }

    return function securityMiddleware(req, res, next) {
        // 管理面板有自己的登录和鉴权逻辑；这里跳过，避免 CC/Referer/UA 规则误伤后台资源。
        if (shouldBypassAdminPanel(req)) {
            return next();
        }
        const ip = (req.headers["x-forwarded-for"] || req.connection.remoteAddress || "").split(",")[0].trim();

        // 白名单直接放行
        if (whitelistSet.has(ip)) {
            return next();
        }

        const now = Date.now();
        let record = ipMap.get(ip);

        if (!record) {
            record = { count: 0, first: now, invalidCount: 0, invalidFirst: now, bannedUntil: 0, banCount: 0, perma: false };
            ipMap.set(ip, record);
        }

        // 若永久封禁或仍在封禁期
        if (record.perma || (record.bannedUntil && record.bannedUntil > now)) {
            const remain = record.perma ? '永久' : `${Math.ceil((record.bannedUntil - now)/1000)}s`;
            record.warnCount = (record.warnCount || 0) + 1;
            if (record.warnCount <= warnBeforeDrop) {
                // 先给友好错误，再升级为 444
                res.status(419).json({
                    code: 419,
                    message: `[安全组件] 请求禁止阈值，请稍后再试。`
                });
                return;
            }
            dropConnection(req, res, `封禁期内多次请求 (${record.warnCount}) IP: ${ip} (剩余 ${remain})`);
            return;
        }

        // --- UA / Referer / POST Size 检测 ---
        const ua = (req.headers["user-agent"] || "").toLowerCase();
        const referer = req.headers["referer"] || "";

        // UA 黑名单命中
        if (uaBlacklistArr.some(bad => bad && ua.includes(bad))) {
            record.invalidCount += 1;
            res.status(403).json({
                code: 403,
                message: "[安全组件] 已拦截异常 User-Agent 请求"
            });
            return;
        }

        // Referer 检测（若配置了白名单）
        if (refererWhitelistArr.length && !refererWhitelistArr.some(allow => referer.startsWith(allow))) {
            record.invalidCount += 1;
            res.status(403).json({
                code: 403,
                message: "[安全组件] 非法 Referer，拒绝访问"
            });
            return;
        }

        // POST Size 检测
        if (["POST", "PUT", "PATCH"].includes(req.method)) {
            const len = Number(req.headers["content-length"] || 0);
            if (len > maxPostSizeKB * 1024) {
                record.invalidCount += 1;
                res.status(413).json({
                    code: 413,
                    message: "[安全组件] 提交内容过大，拒绝处理"
                });
                return;
            }
        }

        // IP 黑名单检测
        if (ipBlacklistArr.some(bad => bad && inCidr(ip, bad))) {
            dropConnection(req, res, `IP 黑名单命中 ${ip}`);
            return;
        }

        // 统计窗口内计数
        if (now - record.first <= timeWindow * 1000) {
            record.count += 1;
        } else {
            // 重新开始窗口
            record.first = now;
            record.count = 1;
        }

        // 触发阈值 => 封禁
        if (record.count > maxRequests) {
            record.banCount = (record.banCount || 0) + 1;
            const duration = banTime * Math.pow(2, record.banCount - 1);
            record.bannedUntil = now + duration * 1000;
            if (record.banCount >= maxBanCount) {
                record.perma = true;
                record.bannedUntil = Number.MAX_SAFE_INTEGER;
                console.warn(`~ [Security] IP ${ip} 已达到最大封禁次数 (${record.banCount})，执行永久封禁!`);
            }
            console.warn(`~ [Security] 触发保护，封禁 IP: ${ip} 时长 ${duration}s (窗口 ${timeWindow}s 内请求 ${record.count} 次, 累计封禁 ${record.banCount} 次)`);
            res.status(429).json({
                code: 429,
                message: "[安全组件] 请求过于频繁，已触发安全模块过滤保护，请稍后再试。"
            });
            return;
        }

        // 监听本次请求完成结果，用于统计无效状态码
        res.on('finish', () => {
            const status = res.statusCode;
            if (!invalidCodesSet.has(status)) return;

            const finishTime = Date.now();

            // 判断无效窗口
            if (finishTime - record.invalidFirst <= timeWindow * 1000) {
                record.invalidCount += 1;
            } else {
                record.invalidFirst = finishTime;
                record.invalidCount = 1;
            }

            if (record.invalidCount > invalidMaxRequests) {
                record.banCount = (record.banCount || 0) + 1;
                const duration = invalidBanTime * Math.pow(2, record.banCount - 1);
                record.bannedUntil = finishTime + duration * 1000;
                if (record.banCount >= maxBanCount) {
                    record.perma = true;
                    record.bannedUntil = Number.MAX_SAFE_INTEGER;
                    console.warn(`~ [Security] IP ${ip} 已达到最大封禁次数 (${record.banCount})，执行永久封禁!`);
                }
                console.warn(`~ [Security] 触发 INVALID 保护，封禁 IP: ${ip} 时长 ${duration}s (窗口 ${timeWindow}s 内无效请求 ${record.invalidCount} 次, 累计封禁 ${record.banCount} 次)`);
            }
        });

        next();
    };


}; 
