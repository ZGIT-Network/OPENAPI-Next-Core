const express = require('express');
const router = express.Router();
const db = require('../../core/database.js');

const plugin_info = {
  name: 'example-next',
  version: 'v1.0',
  avatar: 'example',
};

console.log(
  `+ 模块: ${plugin_info.name} - ${plugin_info.version} (作者: ${plugin_info.avatar}) 已载入数据.`
);

// 创建连接池 + 初始化表（基础表由 core/database.ensureTables() 负责）
db.createPool();
db.ensureTables().catch((e) => {
  console.error('[example-next] ensureTables failed:', e);
});

async function ensureExampleTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS example_next_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(128) NOT NULL,
      content TEXT,
      status INT DEFAULT 0,
      pinned TINYINT(1) DEFAULT 0,
      category VARCHAR(32) DEFAULT 'general',
      created_at VARCHAR(32)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

ensureExampleTables().catch((e) => {
  console.error('[example-next] ensureExampleTables failed:', e);
});

// 基础 hello
router.get('/', (req, res) => {
  res.send('Hello World! (Next plugin)');
  console.log(`~ [${plugin_info.name}] 已处理请求.`);
});

// 示例：返回 JSON
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

// 资源级概览：summary（给 data 页面概览卡片用）
router.get('/summary', async (req, res) => {
  try {
    const rows = await db.query(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) AS pinnedCount, SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS doneCount FROM example_next_items'
    );

    const total = rows && rows[0] ? Number(rows[0].total || 0) : 0;
    const pinnedCount = rows && rows[0] ? Number(rows[0].pinnedCount || 0) : 0;
    const doneCount = rows && rows[0] ? Number(rows[0].doneCount || 0) : 0;

    res.json({
      msg: 'ok',
      status: 200,
      data: {
        total,
        pinnedCount,
        doneCount,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ msg: 'Internal Server Error', status: 500 });
  }
});

module.exports = router;
