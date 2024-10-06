const express = require('express');
const router = express.Router();
// const db = require('../core/database.js');
// const NodeCache = require('node-cache');
// const cache = new NodeCache({stdTTL: 60}); // 缓存时间为60秒，可根据需要调整
//
// // 创建连接池
// db.createPool();
//
// async function fetchData() {
//     const database_name = 'example';
//     const cachedData = cache.get('database_name');
//     if (cachedData) {
//         console.log('~ [Database] 命中缓存');
//         return cachedData;
//     } else {
//         console.log('- [Database] 缓存丢失');
//         try {
//             const results = await db.query('SELECT * FROM database_name');
//              //results即为得到的数据库返回值，可在此处进行处理再返回给事件
//
//              //设置对数据表的缓存
//             cache.set('database_name', results);
//             console.log('+ [Database] 已缓存数据');
//             return results;
//         } catch (err) {
//             console.error(err);
//             throw err;
//         }
//     }
// }
//
// // 使用查询函数并添加缓存
// fetchData().then(results => {
//     if(_config.app.debug){
//     console.log('[DEBUG] \n' + results); // logs the results of the query
//      }
// }).catch(err => {
//     console.error(err); // logs any error
// });
//
// 拆除连接池(有必要时进行.)
// db.closePool();

const plugin_info ={
    "name": "example",
    "version": "v1.0",
    "avatar": "example"
}

console.log("+ 模块: "+plugin_info.name+" - "+plugin_info.version+" (作者: "+plugin_info.avatar+") 已载入数据.")

// 定义你的接口
router.get('/', (req, res) => {
    res.send('Hello World!');
    console.log("~ ["+plugin_info.name+"] " + "已处理请求.")
});

module.exports = router;
