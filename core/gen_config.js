const fs = require('fs');
const crypto = require('crypto');
const ini = require('ini');

const configPath = 'config.ini';

function randomPanelEntry() {
    return `/admin-${crypto.randomBytes(4).toString('hex')}`;
}

function randomAdminKey() {
    return crypto.randomBytes(24).toString('base64url');
}

const defaultConfig = {
    app: {
        port: 3001,
        server_name: '',
        trustProxy: 'loopback',
        debug: false
    },
    mysql: {
        host: 'localhost',
        user: 'root',
        password: 'password',
        database: 'mydb'
    },
    security: {
        enable: true,
        maxRequests: 100,
        timeWindow: 60,
        banTime: 600,
        invalidMaxRequests: 20,
        invalidBanTime: 900,
        maxBanCount: 5,
        whitelist: '127.0.0.1',
        invalidCodes: '404,403,413',
        uaBlacklist: 'curl,bot,spider',
        refererWhitelist: '',
        maxPostSizeKB: 1024,
        ipBlacklist: '',
        warnBeforeDrop: 30
    },
    admin: {
        enable: true,
        controlNextProcess: true,
        panelEntry: randomPanelEntry(),
        nextPort: 3210,
        internalApiBaseUrl: '',
        tokenTtlSeconds: 7200,
        loginMaxAttempts: 8,
        loginWindowSeconds: 300,
        loginBanSeconds: 900,
        key: randomAdminKey(),
        installAllowedHosts: 'github.com,raw.githubusercontent.com,objects.githubusercontent.com,localhost,127.0.0.1'
    },
};

const header = [
    '; OpenAPI 默认配置',
    '; [app].trustProxy 默认 loopback，适合同机 Nginx 反代；跨机器反代时请改成可信代理地址或网段。',
    '; [admin].panelEntry 控制管理面板入口，例如 /admin-a1b2c3d4。',
    '; /admin/api 是后端 API 固定入口，不受 panelEntry 影响。',
    '; [admin].internalApiBaseUrl 默认留空。只有管理面板和核心服务拆分部署时才需要配置。',
    '; [admin].loginMaxAttempts / loginWindowSeconds / loginBanSeconds 用于管理员登录防爆破。',
    '; 首次启动后请检查 MySQL 配置，并妥善保存 admin.key。',
    ''
].join('\n');

fs.writeFileSync(configPath, `${header}${ini.stringify(defaultConfig)}`, 'utf-8');

console.log('[GenConfig] 已创建 config.ini。');
console.log(`[GenConfig] 管理面板入口: ${defaultConfig.admin.panelEntry}`);
console.log(`[GenConfig] 管理员密钥: ${defaultConfig.admin.key}`);
console.log('[GenConfig] 请检查 MySQL 配置，并妥善保存 admin.key，然后重新启动服务。');

process.exit(0);
