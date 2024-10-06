const express = require('express');
const router = express.Router();
// const db = require('../database.js');

// 创建连接池
// db.createPool();
//
// db.query('SELECT * FROM your_table').then(results => {
//     console.log(results); // logs the results of the query
// }).catch(err => {
//     console.log(err); // logs any error
// });
//
// 拆除连接池(有必要时进行.)
// db.closePool();
// use the query function

const plugin_info = {
    "name": "时间校准服务",
    "version": "v1.0",
    "avatar": "Yunmoan"
}

console.log("+ 模块: " + plugin_info.name + " - " + plugin_info.version + " (作者: " + plugin_info.avatar + ") 已载入数据.")

let date = new Date()


// 定义你的接口
router.get('/', (req, res) => {
    switch (req.query.type) {
        case "server":
            res.send({"msg": "网络授时服务在线", "status": 200, "type":"CN|YYYY/MM/DD HH:mm:ss","time": date.toLocaleString()});

            break;
        case "iso":
            res.send({"msg": "网络授时服务在线", "status": 200, "type":"iso","time": date.toISOString()});

            break;
        case "unix":
            res.send({"msg": "网络授时服务在线", "status": 200,"type":"unix", "time": Date.now()});
            break;
        default:
            res.send({"msg": "网络授时服务在线", "status": 200,"type":"unix", "time": Date.now()});
    }

    console.log("~ [" + plugin_info.name + "] " + "校准服务请求已处理，当前时间: " + date.toLocaleString()+Date.now())
});

module.exports = router;
