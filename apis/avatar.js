const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const plugin_info ={
    "name": "Weavatar",
    "version": "v1.0",
    "avatar": "Yunmoan"
}

console.log("+ 模块: "+plugin_info.name+" - "+plugin_info.version+" (作者: "+plugin_info.avatar+") 已载入数据.")

// 定义你的接口
router.get('/', (req, res) => {

    //
    if (req.query.email && req.query.s) {
        let emailMd5 = crypto.createHash('md5').update(req.query.email).digest("hex");
        res.redirect('https://weavatar.com/avatar/' + emailMd5 + '?s=' + req.query.s);
        console.log("302 重定向.邮箱: "+ req.query.email)
    } else {
        res.send('Unknown Request! Use in format: /?email={your email}&s={size}');
    }
    console.log("~ ["+plugin_info.name+"] " + "已处理请求.");
});

module.exports = router;
