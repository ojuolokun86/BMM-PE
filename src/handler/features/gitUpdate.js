// gitUpdate.js
const { exec } = require('child_process');

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

async function getCommits() {
  await run('git fetch');
  const local = await run('git rev-parse --short HEAD');
  const remote = await run('git rev-parse --short @{u}');
  return { local, remote };
}

async function checkUpdate() {
  const { local, remote } = await getCommits();

  return {
    upToDate: local === remote,
    local,
    remote
  };
}

async function normalUpdate() {
  const status = await run('git status --porcelain');
  if (status) {
    return { failed: true, reason: 'Local changes detected. Use `.update force`' };
  }

  const before = await run('git rev-parse --short HEAD');
  const pull = await run('git pull');
  const after = await run('git rev-parse --short HEAD');

  if (before === after) {
    return { updated: false, commit: before };
  }

  const npm = await run('npm install');

  return {
    updated: true,
    from: before,
    to: after,
    pull,
    npm
  };
}

async function forceUpdate() {
  const before = await run('git rev-parse --short HEAD');

  await run('git reset --hard');
  await run('git clean -fd');
  await run('git pull');

  const after = await run('git rev-parse --short HEAD');
  const npm = await run('npm install');

  return {
    updated: before !== after,
    from: before,
    to: after,
    npm
  };
}

module.exports = {
  checkUpdate,
  normalUpdate,
  forceUpdate
};
