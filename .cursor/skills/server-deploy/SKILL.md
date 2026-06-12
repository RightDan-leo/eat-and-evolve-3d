---
name: server-deploy
description: 一键构建并部署 Web 游戏到服务器，支持 SSH/rsync、GitHub Pages、本地预览。当用户提到部署游戏、发布到服务器、deploy、上线、让别人玩、分享游戏时使用。
---

# Server Deploy（服务器部署）

将已开发的 Web 游戏构建并部署到目标服务器，让其他人可以通过浏览器访问游玩。

## 使用方式

```
用户：部署游戏
用户：发布到服务器
用户：deploy
用户：让别人也能玩
用户：启动本地预览
```

## 依赖

SSH 部署方式需要 `ssh2` 包（Node.js 跨平台 SSH 客户端，不依赖系统 rsync/scp/sshpass）：

```bash
npm install -D ssh2
```

## 部署配置文件

项目根目录下的 `deploy.config.json` 存储部署设置：

```json
{
  "method": "ssh",
  "build": {
    "command": "npm run build",
    "outputDir": "dist"
  },
  "ssh": {
    "host": "your-server.com",
    "port": 22,
    "user": "root",
    "remotePath": "/var/www/html/game",
    "privateKey": "~/.ssh/id_rsa",
    "setupNginx": true
  },
  "serverUrl": "https://your-server.com/game"
}
```

> `deploy.config.json` 应加入 `.gitignore`，因为可能包含服务器信息和密码。

**认证方式**（二选一）：
- `privateKey`: SSH 密钥路径（推荐）
- `password`: 密码认证（方便但不安全，仅内网使用）

## 执行流程

### 第 1 步：检查部署配置

1. 读取项目根目录的 `deploy.config.json`
2. 如果不存在，执行「首次配置」流程（见下方）
3. 如果存在，读取配置确认部署方式

### 第 2 步：首次配置

使用 AskQuestion 工具收集部署参数：

**问题 1：部署方式**

| 选项 | 说明 |
|------|------|
| `ssh` | SSH 部署到自有服务器（推荐，最灵活） |
| `github-pages` | 部署到 GitHub Pages（免费，需 GitHub 仓库） |
| `preview` | 启动本地预览服务器（仅局域网内访问） |

**问题 2（SSH 方式时）：服务器信息**

通过文本消息询问用户：

```
请提供服务器信息：
1. 服务器地址（IP 或域名）：
2. SSH 用户名（默认 root）：
3. SSH 端口（默认 22）：
4. 部署路径（默认 /var/www/html/game）：
5. 是否需要自动配置 Nginx？（是/否）
6. 部署后的访问地址（如 https://example.com/game）：
```

收集完毕后生成 `deploy.config.json` 写入项目根目录，并追加到 `.gitignore`。

### 第 3 步：检查 Vite base 路径

**MUST**：如果 `serverUrl` 包含子路径（如 `http://example.com/game`），需要确保：

1. `vite.config.ts` 中设置了生产环境 `base`：
   ```typescript
   base: process.env.NODE_ENV === 'production' ? '/game/' : '/',
   ```
2. 代码中引用 `public/` 目录下资源的绝对路径（如 `/models/xxx.glb`）需要拼接 `import.meta.env.BASE_URL`：
   ```typescript
   const url = import.meta.env.BASE_URL + 'models/xxx.glb';
   ```
   否则生产环境会请求根路径 `/models/xxx.glb` 而非 `/game/models/xxx.glb`，导致 404。

如果 `serverUrl` 是根路径部署（如 `http://example.com/`），则不需要特殊处理。

### 第 4 步：构建项目

```bash
npm run build
```

确认 `dist/` 目录生成成功，包含 `index.html` 和静态资源。

### 第 5 步：执行部署

根据 `deploy.config.json` 中的 `method` 字段选择对应方式。

---

## 部署方式详情

### 方式 A：SSH 部署（推荐）

适用于有自有 VPS / 云服务器的场景。

**前提条件**：
- 已安装 `ssh2` 依赖：`npm install -D ssh2`
- 服务器已安装 Web 服务器（Nginx/Caddy/Apache）

**部署命令**（使用本目录下的脚本）：

```bash
node <SKILL_DIR>/deploy.mjs --config <PROJECT_DIR>/deploy.config.json --project <PROJECT_DIR>
```

其中 `<SKILL_DIR>` 是本 SKILL.md 所在目录的绝对路径。

**脚本执行流程**：

1. 读取配置，连接 SSH（支持密钥或密码认证）
2. 展开远程路径（处理 `~`）
3. **清理远程 `assets/` 目录**（防止旧版本带 hash 的 JS/CSS 文件残留）
4. 通过 SFTP 上传 `dist/` 全部文件
5. 如果 `setupNginx: true` 且远程 Nginx 配置不存在：
   - 自动生成 Nginx 配置（区分根路径和子路径部署）
   - 写入 `sites-available`，创建 `sites-enabled` 软链接
   - 测试配置语法，通过则 reload；失败则自动回滚
   - **首次成功后自动将 `setupNginx` 改为 `false`**，避免覆盖用户后续的手动调整

**Nginx 配置模板**：

脚本会根据 `serverUrl` 自动选择合适的模板：

*根路径部署*（如 `http://example.com/`）：
```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/html/game;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|glb|...)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

*子路径部署*（如 `http://example.com/game`）：
```nginx
server {
    listen 80;
    server_name example.com;

    location /game {
        alias /var/www/html/game;
        index index.html;
        try_files $uri $uri/ /game/index.html;

        location ~* \.(js|css|png|glb|...)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

> **注意**：子路径部署时静态资源 location 必须嵌套在主 location 内部，否则无法继承 `alias` 路径，导致 404。

**后续更新部署**：

再次运行同一命令即可。脚本会自动清理旧 assets 并上传新文件，不会重写 Nginx 配置。

### 方式 B：GitHub Pages

适用于项目已托管在 GitHub 的场景。

**前提条件**：
- 项目已初始化 Git 仓库并推送到 GitHub
- 已安装 `gh` CLI 或配置了 Git 远程仓库

**执行流程**：

1. 检查 `vite.config.ts` 中是否设置了 `base` 路径（GitHub Pages 非根目录部署需要）
2. 构建项目
3. 使用 `gh-pages` 部署：

```bash
npm install -D gh-pages
npm run build
npx gh-pages -d dist
```

4. 告知用户访问地址：`https://<username>.github.io/<repo-name>/`

**注意**：首次部署后可能需要等待几分钟 GitHub Pages 才会生效。在仓库的 Settings → Pages 中确认部署状态。

### 方式 C：本地预览服务器

适用于局域网内快速分享给其他人试玩。

**执行流程**：

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

> Vite 的 `preview` 命令默认端口 4173，加 `--host 0.0.0.0` 可使局域网内其他设备访问。

部署完成后告知用户：

```
本机访问：http://localhost:4173/
局域网访问：http://<本机IP>:4173/

同一 Wi-Fi 下的设备（手机、平板、其他电脑）打开上述局域网地址即可游玩。
按 Ctrl+C 停止服务器。
```

获取本机 IP 的方式：
- Windows: `ipconfig` 查看 IPv4 地址
- Mac/Linux: `ifconfig` 或 `ip addr`

---

## 完整执行流程汇总

```
用户说「部署游戏」
    │
    ├── deploy.config.json 存在？
    │   ├── 是 → 读取配置
    │   └── 否 → 首次配置（AskQuestion 收集参数 → 写入配置文件）
    │
    ├── serverUrl 有子路径？
    │   └── 是 → 检查 vite.config.ts base 和代码中的资源路径
    │
    ├── npm run build
    │
    ├── method = ?
    │   ├── ssh → node deploy.mjs（SFTP 上传 + 首次自动 Nginx 配置）
    │   ├── github-pages → npx gh-pages -d dist
    │   └── preview → npm run preview --host 0.0.0.0
    │
    └── 输出部署结果和访问地址
```

## 常见问题

### SSH 连接失败

- 确认服务器 IP/域名正确
- 确认 SSH 密钥已配置（`ssh-copy-id user@host`），或配置中提供了 `password`
- 确认服务器 SSH 端口正确（默认 22）
- Windows 用户：脚本使用 `ssh2` 库，不需要系统 OpenSSH

### 部署后页面空白或资源 404

- **子路径部署**：检查 `vite.config.ts` 的 `base` 是否设置正确（如 `'/game/'`）
- **代码中的绝对资源路径**：`/models/xxx.glb` 需改为 `import.meta.env.BASE_URL + 'models/xxx.glb'`
- GitHub Pages 非根目录部署需要设置 `base: '/<repo-name>/'`

### 部署后旧版本仍然显示

- 浏览器缓存：Ctrl+Shift+R 强制刷新
- 脚本已自动清理远程 `assets/` 目录中的旧 hash 文件

### Nginx 配置需要调整

- 首次部署后 `setupNginx` 已自动设为 `false`，后续部署不会覆盖
- 手动修改：`sudo vim /etc/nginx/sites-available/<siteName>`
- 修改后：`sudo nginx -t && sudo systemctl reload nginx`

### 构建失败

- 先运行 `npm run dev` 确认本地开发正常
- 检查 TypeScript 类型错误：`npx tsc --noEmit`
- 检查依赖是否完整：`npm install`
