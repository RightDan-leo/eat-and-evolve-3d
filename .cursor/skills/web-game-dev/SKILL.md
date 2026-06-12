---
name: web-game-dev
description: Web 游戏开发全流程指南。支持 2D（Phaser 3）和 3D（Three.js）开发、常用操作、Session 管理。当用户提到游戏开发、创建场景、添加角色、继续开发、项目状态时使用。
---

# Web 游戏开发

支持两种开发模式：
- **2D 游戏**：Phaser 3 + TypeScript + Vite
- **3D 游戏**：Three.js + TypeScript + Vite

## 按需加载引擎指南

> **重要**：不要一次性读取所有文档。根据当前项目类型，只读取对应的引擎指南。

1. 读取 `PROJECT_STATUS.md` 中的「游戏类型」字段
2. 根据类型读取本目录下对应的指南：
   - **2D 项目** → 读取 [guide-2d.md](guide-2d.md)
   - **3D 项目** → 读取 [guide-3d.md](guide-3d.md)

如果 `PROJECT_STATUS.md` 不存在或未标注类型，检查 `package.json` 的依赖：
- 有 `phaser` → 2D
- 有 `three` → 3D

---

## 快速开始

```bash
npm run dev     # 启动开发服务器
npm run build   # 构建生产版本
```

---

## Session 管理

跨 Session 恢复上下文的机制，确保每次新对话都能无缝继续开发。

### 新 Session 开始时

当用户说「继续游戏开发」或类似指令：

1. 读取 `PROJECT_STATUS.md` → 了解当前阶段和上次进度
2. 读取 `specs/_index.md` → 了解各模块实现状态
3. 根据游戏类型读取对应引擎指南（guide-2d.md 或 guide-3d.md）
4. 向用户汇报：当前阶段、上次完成内容、下一步建议

> 如需查看更早的 session 历史，读取 `SESSION_HISTORY.md`。

### Session 结束时

当用户说「更新项目状态」或明确要结束：

1. 更新 `PROJECT_STATUS.md`：
   - 新增一条 Session 记录（日期 + 完成内容）
   - 更新「下次要做」清单
   - 记录已知问题
   - 更新里程碑状态
2. **归档旧 Session**：如果 `PROJECT_STATUS.md` 中的 Session 记录超过 3 条，将最早的记录归档（见下方归档规则）
3. 同步有变更的 spec 状态
4. 更新 `specs/_index.md` 的统计数据

### Session 归档规则

`PROJECT_STATUS.md` 只保留最近 **3 个 Session** 的详细记录。更早的 Session 归档到 `SESSION_HISTORY.md`。

归档操作使用 **append-only** 方式，避免读取历史文件：

```bash
# 将归档内容追加到 SESSION_HISTORY.md（无需先读取该文件）
echo "
### {YYYY-MM-DD}（Session N）
**完成内容**：
- {内容}

**未完成**：
- {内容}
" >> SESSION_HISTORY.md
```

归档后从 `PROJECT_STATUS.md` 的「最近 Session」中删除已归档的条目。

### PROJECT_STATUS.md 格式

```markdown
## 当前阶段
阶段 X：{阶段名}

## 最近 Session（仅保留最近 3 条）
### {YYYY-MM-DD}（Session N）
**完成内容**：
- {内容 1}

**未完成**：
- {内容}

## 下次要做
- [ ] {任务 1}

## 已知问题
- {问题}

## 里程碑
| 阶段 | 状态 |
```

### SESSION_HISTORY.md 格式

append-only 的归档文件，按时间顺序追加。首次创建时写入头部：

```markdown
# Session 历史归档

从 PROJECT_STATUS.md 归档的早期 Session 记录。

---
```

后续每次归档只需 `echo >> SESSION_HISTORY.md`，不读取该文件。

---

## 配置驱动开发（MUST）

游戏中所有可调数值**必须**提取到 `src/config/data/*.json` 配置文件，不要硬编码在逻辑代码中。

### 何时创建配置文件

在以下时机**主动**创建或更新 JSON 配置：

- **创建新实体**（玩家、敌人、道具等）→ 将速度、血量、伤害等数值提取到配置
- **创建新系统**（计分、难度、生成器等）→ 将阈值、间隔、概率等参数提取到配置
- **创建新场景** → 将场景参数（重力、边界、背景色等）提取到配置

### 配置文件规范

```
src/config/data/
├── player.json      ← 玩家相关数值
├── enemies.json     ← 敌人相关数值
├── difficulty.json  ← 难度曲线
└── ...
```

每个 JSON 文件对应一个游戏模块，命名使用小写 kebab-case 或单词形式。

### Schema 同步（MUST）

每次创建或修改 `src/config/data/*.json` 时，**必须同步**在 `tools/config-editor/schemas.ts` 中添加/更新对应的 schema 定义。具体的 schema 格式和字段类型规则，读取 `config-editor` SKILL 了解。

> 如果 `tools/config-editor/` 目录不存在（新项目），需要先完成 Config Editor 的初始化设置（参考 `config-editor` SKILL 中的工具位置说明，将模板文件复制到游戏项目）。

---

## 部署发布

开发完成后，说「部署游戏」或「发布到服务器」即可触发 `server-deploy` Skill，支持：

- **SSH 部署** — 一键上传到自有 VPS / 云服务器
- **GitHub Pages** — 免费静态托管
- **本地预览** — 局域网内分享试玩

详细用法见 `server-deploy` SKILL。

---

## 附加资源

- [游戏开发流程](game-dev-workflow.md)
- [项目结构详解](project-structure.md)

### 引擎指南（按需读取）

- [2D 开发指南 — Phaser 3](guide-2d.md)
- [3D 开发指南 — Three.js](guide-3d.md)
