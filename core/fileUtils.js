const fs = require('fs');
const path = require('path');

function isWithinDir(baseDir, targetPath) {
    const rel = path.relative(baseDir, targetPath);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function removeDirRecursive(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
    }
}

module.exports = {
    isWithinDir,
    removeDirRecursive,
    removeFile
};
