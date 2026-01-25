const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

function getLocalVersion() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
  );
  return pkg.version;
}

/* 🔍 CHECK UPDATE */
async function checkUpdate() {
  await run('git fetch origin');

  const localCommit = await run('git rev-parse --short HEAD');
  const remoteCommit = await run('git rev-parse --short origin/main');

  const localVersion = getLocalVersion();

  const remotePkg = await run('git show origin/main:package.json');
  const remoteVersion = JSON.parse(remotePkg).version;

  return {
    upToDate:
      localCommit === remoteCommit &&
      localVersion === remoteVersion,
    localCommit,
    remoteCommit,
    localVersion,
    remoteVersion
  };
}

/* 🔄 NORMAL UPDATE */
async function normalUpdate() {
  const fromVersion = getLocalVersion();
  const fromCommit = await run('git rev-parse --short HEAD');

  await run('git pull origin main');
  await run('npm install --production');

  const toVersion = getLocalVersion();
  const toCommit = await run('git rev-parse --short HEAD');

  return {
    updated:
      fromVersion !== toVersion ||
      fromCommit !== toCommit,
    fromVersion,
    toVersion,
    fromCommit,
    toCommit
  };
}

/* 🔥 FORCE UPDATE */
async function forceUpdate() {
  const fromVersion = getLocalVersion();
  const fromCommit = await run('git rev-parse --short HEAD');

  await run('git fetch origin');
  await run('git reset --hard origin/main');
  await run('npm install --production');

  const toVersion = getLocalVersion();
  const toCommit = await run('git rev-parse --short HEAD');

  return {
    fromVersion,
    toVersion,
    fromCommit,
    toCommit
  };
}

module.exports = {
  checkUpdate,
  normalUpdate,
  forceUpdate
};
