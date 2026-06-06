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
trustProxy=loopback
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

[admin]
enable=true
controlNextProcess=true
panelEntry=/admin-a1b2c3d4
nextPort=3210
internalApiBaseUrl=
tokenTtlSeconds=7200
loginMaxAttempts=8
loginWindowSeconds=300
loginBanSeconds=900
key=首次生成时会自动生成随机密钥
installAllowedHosts=github.com,raw.githubusercontent.com,objects.githubusercontent.com,localhost,127.0.0.1
```
***
### 静态文件
若有特别需求需要静态文件，请将其置于 ``public`` 目录下

优先级： 静态文件>动态API

***
### 管理面板
管理面板入口由 ``config.ini`` 中的 ``[admin].panelEntry`` 控制。

首次生成配置时会自动生成随机入口和随机 ``admin.key``，请妥善保存。

默认情况下，管理面板仍由核心服务统一挂载，不需要手动配置前端请求地址。

常规 Nginx 反代时，浏览器访问入口即可，例如：
```text
http://{host}/admin-a1b2c3d4
```

``/admin/api`` 是后台 API 固定入口，不受 ``panelEntry`` 影响。

``internalApiBaseUrl`` 默认留空。只有管理面板和核心服务拆开部署时才需要填写，例如核心服务在另一台机器或容器网络内。

管理员登录带有失败次数限制，默认 300 秒内失败 8 次后封禁 900 秒。

``trustProxy`` 默认是 ``loopback``，适合同机 Nginx 反代。若反代服务不在本机，请按实际代理地址或网段调整。

管理面板使用 ``admin-frontend`` 的 Next.js 构建产物。启动时若未检测到可用构建，或 ``panelEntry``、前端源码等发生变化，会自动重新构建。

***
### 设计新 Plugin/API 模块
ZGIT OpenAPI Next 支持两种插件：

- legacy 插件：在 ``/apis/`` 新建 ``.js`` 文件，例如 ``example.js``。
- next 插件：在 ``/apis/`` 新建目录，并在目录中放置 ``index.js`` 与 ``manifest.json``，例如 ``example-next``。

>[!IMPORTANT]
>如何访问新的API？
>
>假设 ``apis/example-next/index.js`` 中定义了 ``/`` 接口，则访问路径为： ``http://{host}/example-next``。
>
>以此类推，假设定义了 ``/json``，那么访问路径为：``http://{host}/example-next/json``。



相关基本插件（示例）代码，此处以 ``apis/example-next`` 为例：
```text
apis/
  example-next/
    index.js
    manifest.json
    README.md
```

``index.js`` 导出 Express Router：
```javascript
// apis/example-next/index.js

const express = require('express');
const router = express.Router();
const db = require('../../core/database.js');

const plugin_info = {
  name: 'example-next',
  version: 'v1.0',
  avatar: 'example',
};

db.createPool();

router.get('/', (req, res) => {
  res.send('Hello World! (Next plugin)');
});

router.get('/json', (req, res) => {
  res.json({
    msg: 'ok',
    status: 200,
    data: {
      plugin: plugin_info.name,
      version: plugin_info.version,
      now: new Date().toISOString(),
    },
  });
});

router.get('/summary', async (req, res) => {
  const rows = await db.query(
    'SELECT COUNT(*) AS total FROM example_next_items'
  );

  res.json({
    msg: 'ok',
    status: 200,
    data: {
      total: rows && rows[0] ? Number(rows[0].total || 0) : 0,
      updatedAt: new Date().toISOString(),
    },
  });
});

module.exports = router;
```

``manifest.json`` 描述插件信息、后台数据资源和管理面板卡片：
```json
{
  "name": "example-next",
  "title": "Next 示例插件",
  "type": "tool",
  "author": "example",
  "version": "v1.0",
  "nav": {
    "group": "示例",
    "path": "/tools/example-next"
  },
  "admin": {
    "cards": [
      {
        "id": "example-summary-overview",
        "title": "示例统计",
        "description": "example-next 当前数据概况",
        "placement": "overview",
        "endpoint": "/example-next/summary",
        "order": 10
      },
      {
        "id": "example-summary-detail",
        "title": "示例统计",
        "description": "插件详情页数据概况",
        "placement": "plugin-detail",
        "endpoint": "/example-next/summary",
        "order": 10
      }
    ],
    "resources": [
      {
        "id": "example_next_items",
        "title": "示例条目",
        "table": "example_next_items",
        "primaryKey": "id",
        "permissions": ["list", "create", "update", "delete"],
        "fields": {
          "id": { "type": "number", "label": "ID", "readonly": true },
          "title": { "type": "string", "label": "标题", "required": true },
          "content": { "type": "text", "label": "内容" },
          "status": { "type": "number", "label": "状态", "required": true, "enum": [0, 1] },
          "pinned": { "type": "boolean", "label": "置顶", "widget": "switch" },
          "category": { "type": "string", "label": "分类", "enum": ["general", "news", "docs"] },
          "created_at": { "type": "string", "label": "创建时间", "format": "date-or-iso" }
        }
      }
    ]
  }
}
```

``admin.resources`` 会进入管理面板的数据管理页。

``admin.cards`` 可注册管理面板卡片，目前支持：

- ``overview``：显示在管理面板概览页。
- ``plugin-detail``：显示在插件详情页。

Manifest 页面会同时显示解析后的内容和 JSON 源文件。

管理面板支持上传 ZIP 安装插件，也支持覆盖更新同名插件。URL 安装受 ``[admin].installAllowedHosts`` 白名单限制。

更完整的示例说明见 ``apis/example-next/README.md``。

规范：即使子模块根目录没有方法，也需要至少返回一个字符串。

***
### 合理使用配置文件

全局变量可使用 ``_config`` 来读取 config 中的数据。

比如，若模块需要判断 debug 模式，可通过 _config.app.debug 判断 true 或者 false 。

同样的，也可以通过 _config 读取任何 config.ini 中的数据。

若要修改默认 config 的内容，可以在 ./core/gen_config 中修改。
