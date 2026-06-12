---
name: art-browser
description: 搜索、下载、解压、转换免费美术资源为 GLB 模型，以及浏览导出已有工程资源。当用户提到寻找美术资源、搜索模型、下载模型、下载资源、找美术素材、搜索免费资源、下载免费模型、搜索 3D 模型、找个模型、需要美术资源时使用。不要与在已有项目中查找代码或文件混淆。
---

# Art Browser

美术资源搜索与管理工具。核心能力：从免费资源站搜索 3D 模型/贴图/音效 → 一键下载解压 → 自动转换为 GLB → 直接用于游戏项目。同时也支持浏览已有工程（如 Unity）的资源并导出为 WebGL 兼容格式。

## 工具位置

工具源码位于本 SKILL.md 同目录下的 `tool/` 子目录。

```
<本文件所在目录>/tool/
```

## 启动

Art Browser 已集成到游戏的 Vite Dev Server 中，无需单独启动：

```bash
npm run dev
# 访问 http://localhost:5173/__art-browser/
```

### 独立模式（开发 Art Browser 本身时使用）

```bash
cd <SKILL_DIR>/tool && npm install
cd <SKILL_DIR>/tool && npm run dev
# 访问 http://localhost:5200/
```

## 核心功能

### 在线美术资源搜索与下载（主要用途）

当用户需要寻找新的美术资源（区别于在已有项目代码中查找文件）：

1. **搜索**：内置多个免费资源站搜索：Poly Pizza、Kenney、Kay Lousberg、Quaternius
2. **预览**：跨站搜索结果预览、资源详情查看
3. **下载**：一键下载到指定目录
4. **解压**：自动解压 zip 包
5. **转换**：FBX/OBJ 等格式自动转换为 GLB（通过 fbx2gltf）
6. **使用**：转换后的 GLB 文件可直接放入游戏项目的 `assets/models/` 目录使用

> **自动触发**：当用户说「找个角色模型」「下载一个树的模型」「搜索免费的建筑素材」「需要美术资源」等，与在已有项目中查找文件不同——这类请求应启动 Art Browser 进行在线资源搜索下载。

### Agent 自动化流程

Agent 可以通过 API 完成全自动搜索 → 下载 → 转换流程，无需用户手动操作浏览器：

```
1. POST /__art-browser/api/search        → 搜索资源（关键词 + 可选站点过滤）
2. GET  /__art-browser/api/search-detail  → 获取资源详情和下载链接
3. POST /__art-browser/api/download-start → 开始下载（指定 targetDir 为项目 assets/models/）
4. GET  /__art-browser/api/download-status → 轮询下载状态直到完成
   → 下载完成后自动解压 zip
   → 如果是 FBX/OBJ 等格式，自动转换为 GLB
5. 资源就绪，可直接在代码中加载使用
```

### 浏览已有工程资源

- 输入工程路径（如 Unity 工程），递归扫描资源目录
- 支持 9 种资源类型：image、model、audio、animation、material、shader、prefab、scene
- 虚拟滚动网格，按类型/文件夹/关键字筛选，按名称/大小/类型排序

### 预览

- 图片：PNG/JPG/GIF/TGA 等
- 3D 模型：FBX/OBJ/glTF/GLB（含贴图、材质、灯光、亮度调节、动画切换）
- 音频：MP3/WAV/OGG 等

### 收藏

- 星标收藏/取消
- 自定义收藏夹（嵌套、新建、重命名、删除）

### 导出

- 多选资源导出为 WebGL 兼容格式
- 3D 模型转 glTF/GLB（通过 fbx2gltf）
- 贴图格式转换（TGA/PSD → PNG/WebP）
- 批量导出 + 导出预设

**导出到当前游戏项目**：将导出路径设为当前游戏项目的 `assets/` 目录即可直接使用。

## API 路由

供 Agent 了解后端能力，用于自动化集成。集成模式下所有路由前缀为 `/__art-browser`：

| 路由 | 方法 | 说明 |
|------|------|------|
| `/__art-browser/api/scan` | POST | 扫描工程目录 |
| `/__art-browser/api/assets` | GET | 获取上次扫描结果 |
| `/__art-browser/api/unity-file/<path>` | GET | 代理访问工程文件 |
| `/__art-browser/api/favorites` | GET/POST | 收藏夹读写 |
| `/__art-browser/api/path-filters` | GET/POST | 路径配置读写 |
| `/__art-browser/api/sites` | GET | 可用资源站列表 |
| `/__art-browser/api/search` | POST | 跨站搜索资源 |
| `/__art-browser/api/search-detail` | GET | 资源详情 |
| `/__art-browser/api/download-start` | POST | 开始下载（自动解压 + 转 GLB） |
| `/__art-browser/api/download-status` | GET | 下载状态 |
| `/__art-browser/api/download-history` | GET | 下载历史 |
| `/__art-browser/api/export` | POST | 开始导出 |
| `/__art-browser/api/export-status` | GET | 导出状态 |

## 典型工作流

### 工作流 A：搜索下载免费美术资源（最常用）

1. `npm run dev` 启动游戏开发服务器
2. 在浏览器访问 `http://localhost:5173/__art-browser/`
3. 切换到「下载」面板，输入关键词搜索
4. 预览、一键下载到游戏项目的 `assets/models/` 目录
5. 自动解压并转换为 GLB，直接在代码中使用

### 工作流 B：从已有工程导出资源

1. `npm run dev` 启动游戏开发服务器
2. 在 `/__art-browser/` 中输入工程路径，扫描资源
3. 浏览、筛选、预览需要的资源
4. 选中资源，设置导出路径为游戏项目的 `assets/` 目录
5. 执行导出，资源自动转换为 WebGL 兼容格式

## 疑难排解

下载或加载 GLB 模型时遇到问题（下载 404、模型不可见、尺寸异常、克隆消失等），参考同目录下的 [GLB-TROUBLESHOOTING.md](GLB-TROUBLESHOOTING.md)。

## 如何区分「搜索美术资源」和「在项目中找文件」

| 用户意图 | 示例 | 应使用的工具 |
|----------|------|-------------|
| 寻找新的美术资源 | 「找个低模角色」「下载树的模型」「搜索免费建筑」 | **Art Browser**（本工具） |
| 在项目中查找已有文件 | 「找到 Player.ts」「config 在哪」「搜索用到了 X 的文件」 | Grep / Glob / 文件搜索 |
