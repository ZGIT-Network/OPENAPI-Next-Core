const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const app = express();
const ini = require('ini');
const chokidar = require('chokidar');
const pluginManager = require('./core/pluginManager');

const configPath = './config.ini';

// 检查配置文件是否存在
if (!fs.existsSync(configPath)) {
    console.log('未检测到配置文件，正在创建...');
    require('./core/gen_config');
}

global._config = ini.parse(fs.readFileSync(configPath, 'utf-8'));

const port = _config.app.port;

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
        console.log(`~ [中间件] 请求响应时间: ${elapsedTime}ms`); // 输出响应时间到console
    });

    next();
};

// 响应时间
app.use(responseTimeLogger);
// 输出请求日志
app.use(morgan(format));
// 载入静态资源
app.use(express.static('public'));

let date = new Date()

console.log('欢迎使用 ZGIT Network OpenAPI 服务核心.\n启动时间：' + date.toISOString() + ' | Node版本:' + process.version + '\n~ 正在启动服务，请稍等...');
if (_config.app.debug) {
    console.log('[DEBUG] 已启用 Debug 模式，将会输出更多日志。')
}

// 加载所有API模块
pluginManager.loadRoutes(path.join(__dirname, '/apis'), app);

// 监听/apis目录的变动并热更新
const watcher = chokidar.watch(path.join(__dirname, '/apis'), {
    ignoreInitial: true
});
watcher.on('add', (filePath) => {
    console.log(`~ [PlugManager] 侦测到文件添加: ${filePath}`);
    pluginManager.loadRoutes(path.join(__dirname, '/apis'), app);
}).on('change', (filePath) => {
    console.log(`~ [PlugManager] 侦测到文件更改: ${filePath}`);
    pluginManager.reloadRoute(filePath, app);
}).on('unlink', (filePath) => {
    console.log(`~ [PlugManager] 侦测到文件移除: ${filePath}`);
    pluginManager.unloadRoute(filePath, app);
});

app.get('/', (req, res) => {
    let date = new Date();
    var currentYear = date.getFullYear();
    res.send("请重试，此处仅限API自动访问，服务状态正常. <br>ZGIT OpenAPI Next 0.1<br><br>Node 版本: "+ process.version+" | 服务器时间戳："+ date.toISOString() +" （"+Date.now()+"）<br><br>"+_config.app.server_name+"<br>&copy; "+currentYear+" "+_config.app.copyright+". All rights reserved.");
});

app.listen(port, () => {
    console.log(`* 服务运行在端口: ${port}`);
});
