# example-next

`example-next` 是一个目录式 Next 代际插件示例，用来说明新插件的推荐结构、manifest 声明、后台数据资源和管理面板卡片注册方式。

## 目录结构

```text
apis/
  example-next/
    index.js
    manifest.json
    README.md
```

`index.js` 导出 Express Router。核心会按插件目录名挂载路由，所以本插件的公开入口是 `/example-next`，不是 `/apis/example-next`。

`manifest.json` 描述插件元信息、导航信息、后台数据资源和管理面板卡片。

## HTTP 接口

核心加载后，本插件注册以下接口：

```text
GET /example-next/
GET /example-next/json
GET /example-next/summary
```

`GET /example-next/` 返回简单文本，用于确认插件已加载。

`GET /example-next/json` 返回基础 JSON：

```json
{
  "msg": "ok",
  "status": 200,
  "data": {
    "plugin": "example-next",
    "version": "v1.0",
    "now": "2026-06-06T00:00:00.000Z"
  }
}
```

`GET /example-next/summary` 返回统计数据，可被数据资源概览卡片和管理面板卡片复用：

```json
{
  "msg": "ok",
  "status": 200,
  "data": {
    "total": 0,
    "pinnedCount": 0,
    "doneCount": 0,
    "updatedAt": "2026-06-06T00:00:00.000Z"
  }
}
```

## manifest 基本信息

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
  }
}
```

`name` 建议与目录名一致。核心使用目录名挂载插件，管理面板使用 `name` 关联 manifest、数据资源和卡片。

## 后台数据资源

`admin.resources` 用于声明可由管理面板自动管理的数据表。

```json
{
  "admin": {
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

字段名会进入 SQL 拼接白名单检查，只应使用 `a-zA-Z0-9_`。

支持的权限：

- `list`
- `create`
- `update`
- `delete`

支持的常用字段能力：

- `type: "string"`：普通输入框。
- `type: "text"`：长文本输入。
- `type: "number"`：数字值；搭配 `enum` 时使用选择器。
- `type: "boolean"` + `widget: "switch"`：布尔开关。
- `readonly: true`：表单中只读。
- `required: true`：标记必填。
- `enum: [...]`：枚举选择。
- `format: "date-or-iso"`：日期或 ISO 字符串提示。

## 资源概览卡片

资源级概览卡片写在 `admin.resources[].overview.cards`，显示在具体数据资源页面。

```json
{
  "overview": {
    "cards": [
      {
        "id": "summary",
        "title": "示例统计",
        "endpoint": "/example-next/summary"
      }
    ]
  }
}
```

`endpoint` 必须是浏览器能访问的同源路径，推荐返回 `{ "data": { ... } }`。

## 管理面板卡片

Next 代际插件可以通过 `admin.cards` 注册管理面板卡片。

```json
{
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
    ]
  }
}
```

当前支持的 `placement`：

- `overview`：管理面板概览页。
- `plugin-detail`：对应插件详情页。

卡片由管理面板统一渲染，插件只需要提供 endpoint。endpoint 返回简单对象时会以键值卡片展示；返回复杂对象或文本时会以代码块展示。

## 数据表初始化

示例插件会在加载后尝试创建 `example_next_items` 表：

```sql
CREATE TABLE IF NOT EXISTS example_next_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  content TEXT,
  status INT DEFAULT 0,
  pinned TINYINT(1) DEFAULT 0,
  category VARCHAR(32) DEFAULT 'general',
  created_at VARCHAR(32)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

建表逻辑位于 `index.js -> ensureExampleTables()`。

## 安装与更新

管理面板支持上传 ZIP 或从白名单 URL 安装 ZIP。

ZIP 推荐结构：

```text
example-next/
  index.js
  manifest.json
  README.md
```

如果 ZIP 根目录不是插件名，可以在安装表单中填写插件名。

同名插件默认不会覆盖。需要更新时，在安装表单中开启“覆盖更新同名插件”，系统会替换旧插件文件并重新加载插件。
