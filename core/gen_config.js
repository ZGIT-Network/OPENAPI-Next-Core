const express = require('express');
const fs = require('fs');

const ini = require('ini');
const configPath = 'config.ini';

// 默认配置
const defaultConfig = {
    app: {
        port: 3001,
        server_name: "",
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
        whitelist: "127.0.0.1",
        invalidCodes: "404,403,413",
        uaBlacklist: "curl,bot,spider",
        refererWhitelist: "",
        maxPostSizeKB: 1024,
        ipBlacklist: "",
        warnBeforeDrop: 30
    }
};

// 写入默认配置到新创建的 ini 文件
fs.writeFileSync(configPath, ini.stringify(defaultConfig));
console.log('[GenConfig] 配置文件创建完毕，请编辑配置文件后重新运行服务。\n服务即将退出.')

// 结束应用程序运行
process.exit();