const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const { spawn } = require('child_process');
const net = require('net');
const app = express();
const ini = require('ini');
const chokidar = require('chokidar');
const pluginManager = require('./core/pluginManager');
const securityMiddleware = require('./core/securityMiddleware');
const metrics = require('./core/metrics');
const { createProxyMiddleware } = require('http-proxy-middleware');

const configPath = './config.ini';

// 检查配置文件是否存在
if (!fs.existsSync(configPath)) {
    console.log('未检测到配置文件，正在创建...');
    require('./core/gen_config');
}

global._config = ini.parse(fs.readFileSync(configPath, 'utf-8'));

const port = _config.app.port;
app.set('trust proxy', normalizeTrustProxyValue(_config.app && _config.app.trustProxy));
const adminPanelEntry = normalizeAdminPanelEntry(_config && _config.admin ? _config.admin.panelEntry : null);
const adminFrontendDir = path.join(__dirname, 'admin-frontend');
const adminFrontendBuildDir = path.join(adminFrontendDir, '.next');
const adminFrontendBuildIdPath = path.join(adminFrontendBuildDir, 'BUILD_ID');
const adminFrontendBuildMetaPath = path.join(adminFrontendBuildDir, 'openapi-admin-build.json');
const adminFrontendRequiredFilesPath = path.join(adminFrontendBuildDir, 'required-server-files.json');
const preferredAdminFrontendPort = Number((_config.admin && _config.admin.nextPort) || 3210);
let adminFrontendPort = preferredAdminFrontendPort;
let adminNextProcess = null;
let adminNextProcessStopping = false;

function normalizeTrustProxyValue(raw) {
    if (raw === undefined || raw === null || raw === '') return 'loopback';
    if (raw === true || raw === false) return raw;

    const value = String(raw).trim();
    if (!value) return 'loopback';
    if (/^(true|1|yes|on)$/i.test(value)) return true;
    if (/^(false|0|no|off)$/i.test(value)) return false;
    return value;
}

function adminInternalApiBaseUrl() {
    const configured = _config.admin && _config.admin.internalApiBaseUrl
        ? String(_config.admin.internalApiBaseUrl).trim()
        : '';
    if (configured) {
        return configured.replace(/\/+$/, '');
    }
    return `http://127.0.0.1:${port}`;
}

function adminFrontendEnv(basePath) {
    return {
        NEXT_PUBLIC_ADMIN_BASE_PATH: basePath,
        ADMIN_INTERNAL_API_BASE_URL: adminInternalApiBaseUrl(),
        NEXT_PUBLIC_OPENAPI_VERSION: '2.0.0',
    };
}

function statMtimeMs(filePath) {
    try {
        return fs.statSync(filePath).mtimeMs;
    } catch {
        return 0;
    }
}

function latestMtimeMs(dirPath) {
    let latest = 0;
    try {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            if (entry.name === '.next' || entry.name === 'node_modules') continue;
            const entryPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                latest = Math.max(latest, latestMtimeMs(entryPath));
            } else if (entry.isFile()) {
                latest = Math.max(latest, statMtimeMs(entryPath));
            }
        }
    } catch {
        return latest;
    }
    return latest;
}

function adminFrontendBuildSignature() {
    const basePath = adminBasePath();
    const env = adminFrontendEnv(basePath);

    return {
        version: 1,
        basePath,
        assetPrefix: basePath || '',
        env,
        packageMtimeMs: statMtimeMs(path.join(adminFrontendDir, 'package.json')),
        lockMtimeMs: statMtimeMs(path.join(adminFrontendDir, 'package-lock.json')),
        nextConfigMtimeMs: statMtimeMs(path.join(adminFrontendDir, 'next.config.ts')),
        sourceMtimeMs: latestMtimeMs(path.join(adminFrontendDir, 'src')),
        appMtimeMs: latestMtimeMs(path.join(adminFrontendDir, 'app')),
    };
}

function adminFrontendLatestInputMtimeMs(signature) {
    const s = signature || adminFrontendBuildSignature();
    return Math.max(
        s.packageMtimeMs || 0,
        s.lockMtimeMs || 0,
        s.nextConfigMtimeMs || 0,
        s.sourceMtimeMs || 0,
        s.appMtimeMs || 0
    );
}

function readAdminFrontendBuildMeta() {
    try {
        return JSON.parse(fs.readFileSync(adminFrontendBuildMetaPath, 'utf-8'));
    } catch {
        return null;
    }
}

function writeAdminFrontendBuildMeta() {
    try {
        fs.writeFileSync(adminFrontendBuildMetaPath, `${JSON.stringify(adminFrontendBuildSignature(), null, 2)}\n`);
    } catch (e) {
        console.warn('~ [Admin] Failed to write admin frontend build metadata:', e && e.message ? e.message : e);
    }
}

function isAdminFrontendBuildMetaCompatible() {
    const actual = readAdminFrontendBuildMeta();
    const expected = adminFrontendBuildSignature();
    if (!actual) {
        const buildMtimeMs = statMtimeMs(adminFrontendBuildIdPath);
        if (buildMtimeMs >= adminFrontendLatestInputMtimeMs(expected)) {
            writeAdminFrontendBuildMeta();
            return true;
        }
        return false;
    }

    return JSON.stringify(actual) === JSON.stringify(expected);
}

function runAdminFrontendBuild() {
    return new Promise((resolve, reject) => {
        const basePath = adminBasePath();
        const childEnv = {
            ...process.env,
            ...adminFrontendEnv(basePath),
        };

        const buildProcess = spawn(process.execPath, [
            path.join(adminFrontendDir, 'node_modules', 'next', 'dist', 'bin', 'next'),
            'build',
        ], {
            cwd: adminFrontendDir,
            env: childEnv,
            stdio: 'pipe',
            windowsHide: true,
        });

        buildProcess.stdout.on('data', (chunk) => {
            process.stdout.write(`[AdminBuild] ${chunk}`);
        });
        buildProcess.stderr.on('data', (chunk) => {
            process.stderr.write(`[AdminBuild] ${chunk}`);
        });
        buildProcess.on('exit', (code) => {
            if (code === 0) {
                writeAdminFrontendBuildMeta();
                resolve();
            } else {
                reject(new Error(`admin frontend build failed with code ${code}`));
            }
        });
    });
}

function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close(() => resolve(true));
        });
        server.listen(port, '127.0.0.1');
    });
}

async function findAvailableAdminFrontendPort(startPort) {
    const firstPort = Number.isFinite(startPort) && startPort > 0 ? startPort : 3210;
    for (let offset = 0; offset < 100; offset += 1) {
        const candidate = firstPort + offset;
        if (await isPortAvailable(candidate)) return candidate;
    }
    throw new Error(`no available admin frontend port near ${firstPort}`);
}

async function ensureAdminFrontendPortAvailable() {
    if (adminNextProcess) return;
    if (await isPortAvailable(adminFrontendPort)) return;

    const nextPort = await findAvailableAdminFrontendPort(adminFrontendPort + 1);
    console.warn(`~ [Admin] nextPort ${adminFrontendPort} is already in use; using ${nextPort} for this admin frontend process.`);
    adminFrontendPort = nextPort;
}

function normalizeAdminPanelEntry(raw) {
    const value = String(raw || '/admin').trim();
    if (!value || value === '/') return '/admin';

    let normalized = value.startsWith('/') ? value : `/${value}`;
    normalized = normalized.replace(/\/+$/, '');
    if (!normalized) return '/admin';
    return normalized;
}

function adminBasePath() {
    return adminPanelEntry === '/admin' ? '' : adminPanelEntry;
}

function hasAdminFrontendBuild() {
    return fs.existsSync(adminFrontendDir) && fs.existsSync(adminFrontendBuildIdPath);
}

function readAdminFrontendBuildConfig() {
    try {
        const requiredFiles = JSON.parse(fs.readFileSync(adminFrontendRequiredFilesPath, 'utf-8'));
        return requiredFiles && requiredFiles.config ? requiredFiles.config : null;
    } catch (e) {
        return null;
    }
}

function isAdminFrontendBuildCompatible() {
    if (!hasAdminFrontendBuild()) return false;

    const buildConfig = readAdminFrontendBuildConfig();
    if (!buildConfig) return false;

    const expectedBasePath = adminBasePath();
    const expectedAssetPrefix = expectedBasePath || '';
    const actualBasePath = buildConfig.basePath || '';
    const actualAssetPrefix = buildConfig.assetPrefix || '';

    return actualBasePath === expectedBasePath && actualAssetPrefix === expectedAssetPrefix && isAdminFrontendBuildMetaCompatible();
}

function isAdminFrontendAvailable() {
    return isAdminFrontendBuildCompatible();
}

function stopAdminNextProcess() {
    if (!adminNextProcess || adminNextProcessStopping) return;
    adminNextProcessStopping = true;

    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/PID', String(adminNextProcess.pid), '/T', '/F'], {
                stdio: 'ignore',
                windowsHide: true,
            });
        } else {
            adminNextProcess.kill('SIGTERM');
        }
    } catch {
        try {
            adminNextProcess.kill();
        } catch {
            // ignore cleanup failures on shutdown
        }
    }
}

function installAdminNextCleanupHandlers() {
    const shutdown = (signal) => {
        stopAdminNextProcess();
        if (signal === 'SIGUSR2') {
            setTimeout(() => process.kill(process.pid, 'SIGUSR2'), 300);
            return;
        }
        process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGUSR2', () => shutdown('SIGUSR2'));
    process.once('exit', stopAdminNextProcess);
}

function startAdminNextProcess() {
    if (adminNextProcess) return;
    if (!fs.existsSync(adminFrontendDir)) {
        console.log('~ [Admin] admin-frontend 目录不存在，跳过 Next 管理面板挂载');
        return;
    }

    const basePath = adminBasePath();
    const childEnv = {
        ...process.env,
        PORT: String(adminFrontendPort),
        ...adminFrontendEnv(basePath),
    };

    adminNextProcess = spawn(process.execPath, [
        path.join(adminFrontendDir, 'node_modules', 'next', 'dist', 'bin', 'next'),
        'start',
        '-p',
        String(adminFrontendPort),
    ], {
        cwd: adminFrontendDir,
        env: childEnv,
        stdio: 'pipe',
        windowsHide: true,
    });

    adminNextProcess.stdout.on('data', (chunk) => {
        process.stdout.write(`[AdminNext] ${chunk}`);
    });
    adminNextProcess.stderr.on('data', (chunk) => {
        process.stderr.write(`[AdminNext] ${chunk}`);
    });
    adminNextProcess.on('error', (e) => {
        console.error('! [Admin] Next 管理面板进程启动失败:', e && e.message ? e.message : e);
        adminNextProcess = null;
        adminNextProcessStopping = false;
    });
    adminNextProcess.on('exit', (code) => {
        console.log(`~ [Admin] Next 管理面板进程已退出，code=${code}`);
        adminNextProcess = null;
        adminNextProcessStopping = false;
    });
}

function mountAdminFrontendProxy() {
    const target = `http://127.0.0.1:${adminFrontendPort}`;
    const basePath = adminBasePath();
    const rewriteAdminAssetPath = (pathname) => {
        if (!basePath) return pathname;
        if (pathname.startsWith(`${basePath}/`)) return pathname;
        if (pathname.startsWith('/_next/') || pathname === '/favicon.ico' || pathname.startsWith('/favicon.ico?')) {
            return `${basePath}${pathname}`;
        }
        return pathname;
    };
    const pathFilter = (pathname) => {
        if (pathname.startsWith('/admin/api')) return false;
        if (pathname.startsWith('/_next/') || pathname === '/favicon.ico' || pathname.startsWith('/favicon.ico?')) return true;
        if (!basePath) {
            return pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/overview') || pathname.startsWith('/plugins') || pathname.startsWith('/data') || pathname.startsWith('/manifests');
        }
        return pathname === adminPanelEntry || pathname.startsWith(`${adminPanelEntry}/`);
    };

    app.use(createProxyMiddleware({
        pathFilter,
        target,
        changeOrigin: true,
        ws: false,
        logLevel: 'silent',
        pathRewrite: rewriteAdminAssetPath,
    }));
}



morgan.token('remote-addr', function (req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
});

var format = '= :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :referrer';

// 添加一个自定义中间件来计算响应时间
const responseTimeLogger = (req, res, next) => {
    const startTime = Date.now(); // 记录请求开始时间

    res.on('finish', () => {
        const endTime = Date.now(); // 记录请求结束时间
        const elapsedTime = endTime - startTime; // 计算响应时间
        const size = res.getHeader('Content-Length') || 0; // 获取响应大小

        metrics.recordRequest({
            path: req.originalUrl || req.url,
            method: req.method,
            status: res.statusCode,
            elapsedMs: elapsedTime,
            sizeBytes: size,
            ts: endTime,
        });

        console.log(`~ [中间件] 请求响应时间: ${elapsedTime}ms | 响应大小: ${size} bytes`); // 输出响应时间和大小到 console
    });

    next();
};

async function start() {
    installAdminNextCleanupHandlers();
    // 响应时间
    app.use(responseTimeLogger);
    // 输出请求日志
    app.use(morgan(format));
    // 安全防护（可在 config.ini [security] 段配置策略）
    if (!_config.security || _config.security.enable !== false) {
        app.use(securityMiddleware({
            ...(_config.security || {}),
            adminPanelEntry,
        }));
    } else {
        setTimeout(() => {
            console.log(`~ [Security] 警告: 基础安全组件已禁用, 请注意确保服务安全性.`);
        }, 1580);
    }

    // 载入静态资源
    app.use(express.static('public'));

    let date = new Date()

    console.log('欢迎使用 ZGIT Network OpenAPI 服务核心.\n启动时间：' + date.toISOString() + ' | Node版本:' + process.version + '\n~ 正在启动服务，请稍等...');
    if (_config.app.debug) {
        console.log('[DEBUG] 已启用 Debug 模式，将会输出更多日志。')
    }

    // 加载所有API模块（保持旧版加载逻辑调用点，但内部实现已升级）
    pluginManager.init(app, __dirname);
    pluginManager.loadRoutes();

    // 管理员后台 API（登录/插件清单等）
    const { createAdminAuth } = require('./core/adminAuth');
    const { createAdminApiRouter } = require('./core/adminApi');

    const adminAuth = createAdminAuth(_config);
    app.use('/admin/api', createAdminApiRouter(adminAuth, pluginManager, _config));
    if ((_config.admin && _config.admin.controlNextProcess) !== false) {
        if (!isAdminFrontendAvailable()) {
            const reason = hasAdminFrontendBuild() ? `build output is stale for panelEntry ${adminPanelEntry}` : 'missing Next build output';
            console.log(`~ [Admin] ${reason}; building admin-frontend...`);
            console.log('~ [Admin] 未检测到 Next 构建产物，正在尝试构建 admin-frontend...');
            try {
                await runAdminFrontendBuild();
            } catch (e) {
                console.error('! [Admin] 管理面板构建失败:', e && e.message ? e.message : e);
            }
        }

        if (isAdminFrontendAvailable()) {
            await ensureAdminFrontendPortAvailable();
            startAdminNextProcess();
            mountAdminFrontendProxy();
        } else {
            console.log('~ [Admin] Next 管理面板仍不可用，跳过挂载。');
        }
    }



    // 监听/apis目录的变动并热更新
    const watcher = chokidar.watch(path.join(__dirname, '/apis'), {
        ignoreInitial: true
    });
    watcher.on('add', (filePath) => {
        console.log(`~ [PlugManager] 侦测到文件添加: ${filePath}`);
        pluginManager.reloadAllPlugins();
    }).on('change', (filePath) => {
        console.log(`~ [PlugManager] 侦测到文件更改: ${filePath}`);
        pluginManager.reloadAllPlugins();
    }).on('unlink', (filePath) => {
        console.log(`~ [PlugManager] 侦测到文件移除: ${filePath}`);
        pluginManager.reloadAllPlugins();
    });

    app.get('/', (req, res) => {
        // Replace this with the actual informations
        let date = new Date()
        res.send("请重试，此处仅限API自动访问，服务状态正常. <br>ZGIT OpenAPI Next v2.0.0<br><br>Node 版本: "+ process.version+" | 服务器时间戳："+ date.toISOString() +" （"+Date.now()+"）<br><br>Network "+_config.app.server_name+"<br>&copy; 2016-2025 ZGIT Network. All rights reserved.");
    });

    app.listen(port, () => {
        console.log(`* 服务运行在端口: ${port}`);
    });
}

start().catch((e) => {
    console.error('! 启动失败:', e);
    process.exit(1);
});
