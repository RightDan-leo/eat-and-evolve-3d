/**
 * SSH Deploy Script — 使用 ssh2 (SFTP) 跨平台部署，不依赖 rsync/scp/sshpass。
 *
 * 用法：node deploy.mjs --config <deploy.config.json> --project <project-dir>
 *
 * 依赖：npm install ssh2（项目 devDependency）
 */

import { Client } from 'ssh2';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, posix } from 'path';

// ── CLI args ──

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : null;
}

const configPath = getArg('--config');
const projectDir = getArg('--project');
if (!configPath || !projectDir) {
  console.error('Usage: node deploy.mjs --config <config.json> --project <dir>');
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, 'utf-8'));
const distDir = join(projectDir, config.build.outputDir);
const ssh = config.ssh;

// ── Helpers ──

function collectFiles(dir, base = '') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? posix.join(base, entry.name) : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, rel));
    } else {
      files.push({ local: full, remote: rel, size: statSync(full).size });
    }
  }
  return files;
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '', errOut = '';
      stream.on('data', (d) => (out += d));
      stream.stderr.on('data', (d) => (errOut += d));
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`Exit ${code}: ${cmd}\n${errOut}`));
        else resolve(out.trim());
      });
    });
  });
}

function getSftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
  });
}

function sftpWriteFile(sftp, remotePath, data) {
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, data, (err) => (err ? reject(err) : resolve()));
  });
}

function sftpStat(sftp, remotePath) {
  return new Promise((resolve) => {
    sftp.stat(remotePath, (err, stats) => resolve(err ? null : stats));
  });
}

function sftpMkdir(sftp, dir) {
  return new Promise((resolve) => {
    sftp.mkdir(dir, () => resolve());
  });
}

async function mkdirp(sftp, dir) {
  if (await sftpStat(sftp, dir)) return;
  const parent = posix.dirname(dir);
  if (parent !== dir) await mkdirp(sftp, parent);
  await sftpMkdir(sftp, dir);
}

// ── Nginx config generation ──

function generateNginxConfig(remotePath, serverUrl, host) {
  let urlPath;
  try {
    urlPath = new URL(serverUrl).pathname.replace(/\/+$/, '');
  } catch {
    urlPath = '';
  }

  const isSubPath = urlPath && urlPath !== '/';

  const staticLocation = `
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|glb|gltf|mp3|ogg|wav)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }`;

  const gzip = `
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/wasm model/gltf-binary;`;

  if (isSubPath) {
    return `server {
    listen 80;
    server_name ${host};

    location ${urlPath} {
        alias ${remotePath};
        index index.html;
        try_files $uri $uri/ ${urlPath}/index.html;
${staticLocation}
    }
${gzip}
}`;
  }

  return `server {
    listen 80;
    server_name ${host};
    root ${remotePath};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
${staticLocation}
${gzip}
}`;
}

// ── Main deploy ──

async function deploy() {
  const files = collectFiles(distDir);
  const totalKB = (files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1);
  console.log(`📦 Found ${files.length} files to upload (${totalKB} KB)`);

  // 1. Connect
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    const opts = { host: ssh.host, port: ssh.port || 22, username: ssh.user };
    if (ssh.password) opts.password = ssh.password;
    else if (ssh.privateKey) {
      const keyPath = ssh.privateKey.replace(/^~/, process.env.HOME || process.env.USERPROFILE);
      opts.privateKey = readFileSync(keyPath);
    }
    conn.connect(opts);
  });
  console.log(`🔗 Connected to ${ssh.user}@${ssh.host}`);

  // 2. Resolve remote path (expand ~)
  const remotePath = (await exec(conn, `echo ${ssh.remotePath}`)).trim();
  console.log(`📂 Remote path: ${remotePath}`);

  // 3. Clean remote assets/ to prevent stale hashed files
  try {
    await exec(conn, `rm -rf "${remotePath}/assets" 2>/dev/null; mkdir -p "${remotePath}"`);
    console.log('🧹 Cleaned remote assets/');
  } catch {
    await exec(conn, `mkdir -p "${remotePath}"`);
  }

  // 4. Upload via SFTP
  const sftp = await getSftp(conn);

  const dirs = new Set();
  for (const f of files) {
    dirs.add(posix.dirname(posix.join(remotePath, f.remote)));
  }
  for (const dir of [...dirs].sort()) {
    await mkdirp(sftp, dir);
  }

  let uploaded = 0;
  for (const f of files) {
    const target = posix.join(remotePath, f.remote);
    await sftpWriteFile(sftp, target, readFileSync(f.local));
    uploaded++;
    process.stdout.write(`\r  Uploading: ${uploaded}/${files.length} - ${f.remote}`);
  }
  console.log('\n✅ Upload complete!');

  // 5. Nginx config — only if setupNginx is true AND config doesn't already exist on server
  if (ssh.setupNginx) {
    let urlPath;
    try {
      urlPath = new URL(config.serverUrl).pathname.replace(/\/+$/, '');
    } catch {
      urlPath = '';
    }
    const siteName = urlPath.replace(/\//g, '') || 'game';
    const remoteConfPath = `/etc/nginx/sites-available/${siteName}`;

    let exists = false;
    try {
      await exec(conn, `test -f ${remoteConfPath}`);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      console.log(`⏭️  Nginx config ${remoteConfPath} already exists, skipping (set setupNginx=false to suppress this message)`);
    } else {
      console.log('🔧 Configuring Nginx (first time)...');
      const nginxConf = generateNginxConfig(remotePath, config.serverUrl, ssh.host);
      const tmpPath = '/tmp/_deploy_nginx.conf';
      await sftpWriteFile(sftp, tmpPath, nginxConf);
      await exec(conn, `sudo cp ${tmpPath} ${remoteConfPath}`);
      await exec(conn, `sudo ln -sf ${remoteConfPath} /etc/nginx/sites-enabled/${siteName}`);

      try {
        await exec(conn, 'sudo nginx -t 2>&1');
        await exec(conn, 'sudo systemctl reload nginx');
        console.log('  Nginx configured and reloaded!');
      } catch (e) {
        console.warn('  ⚠️ Nginx test failed, rolling back:', e.message);
        await exec(conn, `sudo rm -f ${remoteConfPath} /etc/nginx/sites-enabled/${siteName}`);
        await exec(conn, 'sudo systemctl reload nginx');
      }

      // Auto-disable setupNginx for subsequent deploys
      config.ssh.setupNginx = false;
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      console.log('  Updated deploy.config.json: setupNginx → false');
    }
  }

  conn.end();
  console.log(`\n🎮 Deployed to ${config.serverUrl}`);
}

deploy().catch((e) => {
  console.error('❌ Deploy failed:', e.message);
  process.exit(1);
});
