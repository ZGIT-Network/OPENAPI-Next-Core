const express = require('express');
const fs = require('fs');

const ini = require('ini');
const configPath = 'config.ini';

// 默认配置
const defaultConfig = {
    app: {
        port: 3001,
        server_name: "",
        debug: false,
        copyright: 'ZGIT Network'
    },
    mysql: {
        host: 'localhost',
        user: 'root',
        password: 'password',
        database: 'mydb'
    }
};

// 写入默认配置到新创建的 ini 文件
fs.writeFileSync(configPath, ini.stringify(defaultConfig));
console.log('[GenConfig] 配置文件创建完毕，请编辑配置文件后重新运行服务。\n服务即将退出.')

// 结束应用程序运行
process.exit();
