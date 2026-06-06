# ZGIT OpenAPI Next
基于 Node.js 开发的轻量级、模块化 API 服务核心

支持模块热更新/添加/移除，避免影响业务连续性。

```
Develop Node Version: v20.12.2
```

## 安装依赖
``npm install``

## 运行
``node index.js``

## 特殊说明
### 配置文件
默认情况会自动生成配置文件 ``config.ini``

如无法生成，请手动新建：
```ini 
# config.ini

[app]
port=3001
server_name=本地主机
debug=false

[mysql]
host=localhost
user=username
password=pass
database=database

[security]
enable      = true        ; 是否启用
maxRequests = 100         ; 窗口内最大请求数
timeWindow  = 60          ; 统计窗口 (秒)
banTime     = 600         ; 封禁时长 (秒)
whitelist   = 127.0.0.1   ; 逗号分隔白名单
```
***
### 静态文件
若有特别需求需要静态文件，请将其置于 ``public`` 目录下

优先级： 静态文件>动态API

***
### 设计新 Plugin/API 模块
在 ``/apis/`` 新建 .js 文件即可识别为新的模块，比如 ``example.js``（不知道是否支持中文，不建议使用中文）

ZGIT OpenAPI Next 支持自动化加载新的 API.JS 模块，新建或者修改 api 时需要重启服务。

>[!IMPORTANT]
>如何访问新的API？
>
>假设 ``example123.js`` 文件中定义了 ``/`` 接口，则的访问路径为： ``http://{host}/example123``。
>
>以此类推，假设定义了``/114514``，那么访问路径为：``http://{host}/example123/114514``。



相关基本插件（示例）代码，此处以文件名 ``example.js`` 为例：
```javascript
// example.js

const express = require('express');
const router = express.Router();


////////DATABASE////////////
// 这部分代码用于数据库连接，如果不需要请勿引用并移除此部分代码.
const db = require('../core/database.js');
const NodeCache = require('node-cache');
const cache = new NodeCache({stdTTL: 60}); // 缓存时间为60秒，可根据需要调整

// 创建连接池
db.createPool();

async function fetchData() {
    const database_name = 'example';
    const cachedData = cache.get('database_name');
    if (cachedData) {
        console.log('~ [Database] 命中缓存');
        return cachedData;
    } else {
        console.log('- [Database] 缓存丢失');
        try {
            const results = await db.query('SELECT * FROM database_name');
            //results即为得到的数据库返回值，可在此处进行处理再返回给事件

            //设置对数据表的缓存
            cache.set('database_name', results);
            console.log('+ [Database] 已缓存数据');
            return results;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
}

// 使用查询函数并添加缓存
fetchData().then(results => {
    if(_config.app.debug){
        console.log('[DEBUG] \n' + results); // logs the results of the query
    }
}).catch(err => {
    console.error(err); // logs any error
});

//拆除连接池(有必要时进行.)
db.closePool();
// 上面全是数据库连接部分

/////////////////////////////
// 主要实现部分

// 这里是模块名称定义的部分，依次是插件名，版本号和作者
const plugin_info ={
    "name": "example",
    "version": "v1.0",
    "avatar": "example"
}

// 模块信息日志输出
console.log("+ 模块: "+plugin_info.name+" - "+plugin_info.version+" (作者: "+plugin_info.avatar+") 已载入数据.")


// 定义接口(GET)
router.get('/', (req, res) => { //这个接口的请求路径就是 http://{host}/example/ 这样的
    //在此处写入相关原理实现
    //...
    
    res.send('Hello World!'); //使用此函数发送回复
    console.log("~ ["+plugin_info.name+"] " + "已处理GET请求.") //日志输出，可以自行更改
});

// 定义接口(POST)
router.post('/post', (req, res) => { //这个接口的请求路径就是 http://{host}/example/ 这样的
    //在此处写入相关原理实现
    //...
    // 在这里处理你的 POST 请求数据
    // console.log(req.body);

    // 假设你已经处理好了请求，并准备回送一个响应
    res.json({ message: '子接口 POST 请求成功!' });
    // res.send('Hello World!'); //使用此函数发送回复
    console.log("~ ["+plugin_info.name+"] " + "已处理POST请求.") //日志输出，可以自行更改
});

/*
 这里可以继续当前接口添加子接口，比如/jas (GET)
 
 router.get('/jas', (req, res) => {
    res.send('Hello World!');
    console.log("~ ["+plugin_info.name+"] " + "已处理请求.")
  });
  
  请求接口的路径就是：
  http://{host}/example/jas
 */


module.exports = router;
```
规范：即使子模块根目录没有方法，也需要至少返回一个字符串。

***
### 合理使用配置文件

全局变量可使用 ``_config`` 来读取 config 中的数据。

比如，若模块需要判断 debug 模式，可通过 _config.app.debug 判断 true 或者 false 。

同样的，也可以通过 _config 读取任何 config.ini 中的数据。

若要修改默认 config 的内容，可以在 ./core/gen_config 中修改。
