//MySQL数据库驱动
const express = require('express');
const mysql = require('mysql');
const app = express();



console.log("~ 探测数据库IP：" + _config.mysql.host);

let pool = null;

function createPool() {
    pool = mysql.createPool({
        host: _config.mysql.host,
        user: _config.mysql.user,
        password: _config.mysql.password,
        database: _config.mysql.database
    });
}

function closePool() {
    if (pool) {
        pool.end(function (err) {
            if (err) {
                console.error('error disconnecting: ' + err.stack);
                return;
            }
            console.log('Disconnected from database');
            pool = null;
        });
    }
}

exports.query = function (sql, params) {
    return new Promise((resolve, reject) => {
        if (!pool) {
            reject(new Error('Call createPool() first.'));
            return;
        }
        pool.getConnection((err, connection) => {
            if (err) {
                reject(err);
                return;
            }
            connection.query(sql, params, (err, results) => {
                connection.release();
                if (err) {
                    reject(err);
                    return;
                }
                resolve(results);
            });
        });
    });
};

exports.createPool = createPool;
exports.closePool = closePool;

// 确保基础表存在（启动时/首次使用时调用）
let _ensurePromise = null;
async function ensureTables() {
    if (_ensurePromise) return _ensurePromise.catch((err) => {
        _ensurePromise = null;
        throw err;
    });

    _ensurePromise = (async () => {
        if (!pool) createPool();

        // sponsors
        await exports.query(`
            CREATE TABLE IF NOT EXISTS sponsors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(16) NOT NULL,
                sponsor VARCHAR(128),
                avatar VARCHAR(255),
                note VARCHAR(255),
                sum VARCHAR(32),
                date VARCHAR(32),
                title VARCHAR(128),
                platform VARCHAR(64),
                pay_id VARCHAR(128)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // adsense
        await exports.query(`
            CREATE TABLE IF NOT EXISTS adsense (
                id INT AUTO_INCREMENT PRIMARY KEY,
                service VARCHAR(64) NOT NULL,
                title VARCHAR(128),
                description VARCHAR(255),
                url VARCHAR(255),
                img VARCHAR(255),
                tag VARCHAR(64),
                verify VARCHAR(64),
                company VARCHAR(128)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    })();

    return _ensurePromise.catch((err) => {
        _ensurePromise = null;
        throw err;
    });
}

exports.ensureTables = ensureTables;
