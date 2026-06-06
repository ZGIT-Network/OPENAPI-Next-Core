const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function safeName(name) {
    if (!name) return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
    return name;
}

function ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function isWithinDir(baseDir, targetPath) {
    const rel = path.relative(baseDir, targetPath);
    return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function writeFileSafe(baseDir, relativePath, data) {
    const outPath = path.join(baseDir, relativePath);
    if (!isWithinDir(baseDir, outPath)) {
        throw new Error('illegal path');
    }
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, data);
}

function createTempDir(prefix = 'openapi-plugin-') {
    const id = crypto.randomBytes(8).toString('hex');
    const p = path.join(os.tmpdir(), `${prefix}${id}`);
    ensureDir(p);
    return p;
}

module.exports = {
    safeName,
    ensureDir,
    writeFileSafe,
    createTempDir,
    isWithinDir
};
