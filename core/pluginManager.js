const fs = require('fs');
const path = require('path');

let loadedModules = {};

function loadRoutes(directory, app) {
    fs.readdirSync(directory).forEach((file) => {
        let fullPath = path.join(directory, file);
        let stat = fs.lstatSync(fullPath);

        if (stat.isFile() && /.*\.js$/.test(fullPath)) {
            if (!loadedModules[fullPath]) {
                console.log('~ [PlugManager] 载入模块: ' + fullPath);
                console.log('+ [PlugManager] 建立路由链接: /' + file.substring(0, file.length - 3));
                let api = require(fullPath);
                let apiPath = file.substring(0, file.length - 3);
                app.use(`/${apiPath}`, api);
                loadedModules[fullPath] = { api, apiPath, router: app._router.stack[app._router.stack.length - 1] };
            }
        }
    });
}

function unloadRoute(filePath, app) {
    let moduleInfo = loadedModules[filePath];
    if (moduleInfo) {
        let { apiPath, router } = moduleInfo;
        let routes = app._router.stack;
        let index = routes.indexOf(router);
        if (index > -1) {
            routes.splice(index, 1);
        }
        delete require.cache[require.resolve(filePath)];
        delete loadedModules[filePath];
        console.log(`- [PlugManager] 卸载模块: ${filePath}`);
    }
}

function reloadRoute(filePath, app) {
    unloadRoute(filePath, app);
    loadRoutes(path.dirname(filePath), app);
}

module.exports = {
    loadRoutes,
    unloadRoute,
    reloadRoute
};
