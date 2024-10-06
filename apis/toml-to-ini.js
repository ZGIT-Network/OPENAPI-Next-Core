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

const plugin_info ={
    "name": "TOML转换器",
    "version": "v1.0",
    "avatar": "Yunmoan"
}

console.log("+ 模块: "+plugin_info.name+" - "+plugin_info.version+" (作者: "+plugin_info.avatar+") 已载入数据.")

// 定义你的接口
router.get('/', (req, res) => {
    res.send('Hello World!');
    console.log("~ ["+plugin_info.name+"] " + "已处理请求.")
});

module.exports = router;
