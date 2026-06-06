const fs = require('fs');
const path = require('path');

function disabledDirName(name) {
  return `${name}.disabled`;
}

function disabledFileName(name) {
  return `${name}.js.disabled`;
}

function getPaths(apisDir, name) {
  return {
    dir: path.join(apisDir, name),
    dirDisabled: path.join(apisDir, disabledDirName(name)),
    file: path.join(apisDir, `${name}.js`),
    fileDisabled: path.join(apisDir, disabledFileName(name)),
    manifest: path.join(apisDir, `${name}.manifest.json`),
  };
}

function isPhysicallyDisabled(apisDir, name) {
  const p = getPaths(apisDir, name);
  if (fs.existsSync(p.dirDisabled)) return true;
  if (fs.existsSync(p.fileDisabled)) return true;
  return false;
}

function physicalDisable(apisDir, name) {
  const p = getPaths(apisDir, name);

  // dir plugin
  if (fs.existsSync(p.dir) && fs.lstatSync(p.dir).isDirectory()) {
    if (fs.existsSync(p.dirDisabled)) throw new Error('already disabled');
    fs.renameSync(p.dir, p.dirDisabled);
    return { type: 'dir', disabledPath: p.dirDisabled };
  }

  // file plugin
  if (fs.existsSync(p.file) && fs.lstatSync(p.file).isFile()) {
    if (fs.existsSync(p.fileDisabled)) throw new Error('already disabled');
    fs.renameSync(p.file, p.fileDisabled);
    return { type: 'file', disabledPath: p.fileDisabled };
  }

  throw new Error('plugin not found');
}

function physicalEnable(apisDir, name) {
  const p = getPaths(apisDir, name);

  if (fs.existsSync(p.dirDisabled) && fs.lstatSync(p.dirDisabled).isDirectory()) {
    if (fs.existsSync(p.dir)) throw new Error('target exists');
    fs.renameSync(p.dirDisabled, p.dir);
    return { type: 'dir', enabledPath: p.dir };
  }

  if (fs.existsSync(p.fileDisabled) && fs.lstatSync(p.fileDisabled).isFile()) {
    if (fs.existsSync(p.file)) throw new Error('target exists');
    fs.renameSync(p.fileDisabled, p.file);
    return { type: 'file', enabledPath: p.file };
  }

  throw new Error('plugin not physically disabled');
}

module.exports = {
  getPaths,
  isPhysicallyDisabled,
  physicalDisable,
  physicalEnable,
};
