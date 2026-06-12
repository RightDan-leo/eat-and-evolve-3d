# 吞噬进化岛 3D（eat-and-evolve-3d）

3D 俯视「大吃小 / 进化成长」买量 Playable 广告。基于 **Three.js + TypeScript + Vite**，由 2D 版《eat-and-evolve》转化而来。

> 本仓库**仅包含 3D 版**。2D 版（Phaser）是独立工程，不在此仓库内。

## 核心玩法

- 摇杆移动（任意位置拖动 / WASD），吞噬等级 ≤ 自己的怪升级变大。
- 体型随等级增长，相机随之拉高拉远（"世界变小"的爽点）。
- 多阶形态进化（5 阶）+ 元素分支选择（水/自然/火、风暴/钢铁）。
- 环形岛：越靠中心怪越强；散布宝箱（读条开启给经验）。
- 终局双子泰坦登场演出 → **胜利版**吞噬虚空泰坦反杀 / **失败版**被碾压。
- 结算页 CTA 跳转下载（投放转化）。

## 快速开始

前置：Node.js ≥ 18（建议 v24）+ npm。

```bash
npm install
npm run dev
```

- 游戏：http://localhost:5173/
- 失败版：http://localhost:5173/?v=lose
- 配置编辑器：http://localhost:5173/__config/

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（含配置编辑器 / art-browser 插件） |
| `npm run build` | 生产构建到 `dist/` |
| `npm run build:single` | 单文件构建（内联 JS，单个 `dist/index.html`，投放用，约 666KB） |
| `npm run preview` | 预览构建产物（`-- --host 0.0.0.0 --port 4180` 可局域网访问） |

## 版本切换（投放）

URL 参数 `?v=win`（默认）/ `?v=lose` 切换胜利版 / 失败版，二者共用角色与成长数值，仅终局结果不同。

## 参数配置

所有可调数值都抽到了 `src/config/data/*.json`，并接入可视化配置编辑器（`/__config/`，改完热更即时生效）：

| 文件 | 内容 |
|------|------|
| `player.json` | 体型曲线、移动速度、摇杆 |
| `camera.json` | 各等级相机距离/高度、跟随与拉远平滑 |
| `combat.json` | relation 伤害比例、反伤、颜色、接触冷却 |
| `progression.json` | 经验/生命/伤害成长曲线 |
| `enemies.json` | 敌人种类、相对体型缩放表、追逐参数 |
| `arena.json` | 岛屿/分区难度/刷怪/宝箱/环境 |
| `evolution.json` | 形态阶段与进化分支 |
| `endgame.json` | 双子泰坦、登场演出、触发等级 |
| `variants.json` | 胜利/失败版 Boss 数值与结算文案 |
| `fx.json` | 吞噬肉块、进化金环特效 |
| `audio.json` | 音效开关与音量 |

## 目录结构

```
src/
  config/        视图层配置 + data/*.json（全部可调参数）
  core/          SceneManager / BaseScene / ModelUtils 等基础设施
  logic/         纯逻辑层（零 three/DOM）：战斗/成长/进化/刷怪/终局/版本
  systems/       表现层系统：相机、输入、特效、环境、宝箱、音频
  entities/      Dragon（玩家）/ Enemy / Titan
  components/    CSS2D 标签、进化选择面板、结算覆盖层
  scenes/        GameScene 等
tools/config-editor/   配置编辑器 schema 与预览
specs/                 设计与里程碑 spec 文档
```

架构遵循「逻辑 / 表现 / 编排」三层分离，`src/logic/**` 不依赖 Three.js 或 DOM，详见 `specs/architecture.md`。

## 里程碑

M0 相机动态拉远 · M1 核心吞噬 · M2 进化系统 · M3 世界与敌人 · M4 终局与转化 · M5 投放打磨 —— 均已完成，详见 `specs/milestones/` 与 `PROJECT_STATUS.md`。

## 投放约束

单文件 ≤ 5MB、零外部请求、移动端性能优先。当前单文件构建 ≈ 666KB（gzip ≈ 174KB），美术目前为程序化占位，可用 art-browser 替换为 GLB。
