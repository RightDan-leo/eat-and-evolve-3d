# 项目状态

> 本文件由 AI 在每次 Session 结束时维护，用于跨 Session 恢复上下文。

## 项目信息

- **项目名称**：eat-and-evolve-3d（龙噬进化岛 3D 版 / 买量 Playable）
- **技术栈**：Three.js + TypeScript + Vite
- **游戏类型**：3D 俯视吞噬成长
- **项目路径**：d:\Projects\Codex\eat-and-evolve-3d
- **来源**：2D《eat-and-evolve》3D 转化；流程依据 `eat-and-evolve/docs/3D版吞噬-开发文档.md`（参考视频逐帧分析）
- **启动命令**：`npm run dev`

## 当前阶段

**阶段 4：迭代**（M0–M5 全部完成；全参数已抽到 `src/config/data/*.json` 并接入配置编辑器）

## 最近 Session

### 2026-06-12（Session 2）

**完成内容（M2–M5 + 配置）**：
- **M2 进化系统**：`logic/config/evolution.ts` + `EvolutionSystem`（形态阶段/分支推进）；`Dragon.applyForm` 多阶 morph（5 阶 tier 造型）+ `absorbPulse` 体型脉冲；`FxSystem`（吞噬肉块迸射→吸入 + 进化金环）；`EvolutionChoicePanel` 元素分支选择（水/自然/火、风暴/钢铁）。
- **M3 世界与敌人**：`EnvBuilder` 环形草地岛（环岛雪山 + 同心土路 + 树石散布 + 中心紫色灯塔）；`logic/config/arena.ts` + `enemies.ts` + `SpawnSystem`（按离中心距离分区难度、等级权重、starterPrey、回收补刷）；5 种 kind（blob/critter/beast/brute/wyrm，含追逐 AI）；`ChestField` 宝箱（2s 读条开启 + 中心高奖励 + 重生）。
- **M4 终局与转化**：`logic/config/endgame.ts` + `variants.ts`；`Titan` 双子泰坦（虚空/炼狱）；登场演出（其他怪缩小 + 运镜推近 + 延迟字幕）；win=吞噬虚空泰坦反转、lose=不可击杀碾压；`HudOverlay` 结算 + CTA 跳商店 + 再玩一次；`?v=win|lose` 切换版本。
- **M5 打磨**：`AudioSystem`（WebAudio 合成音效，零资源，devour/levelUp/evolve/chest/hit/titan/win/lose + 静音按钮）；像素比上限已在 SceneManager；`ModelUtils` 接入可选 Draco；单文件构建 666KB（gzip 174KB）。
- **配置全暴露（对齐 2D）**：11 个 `src/config/data/*.json`（player/camera/combat/progression/enemies/arena/evolution/endgame/variants/fx/audio），全部 TS 配置改为 JSON 加载器；`tools/config-editor/schemas.ts` 覆盖全部参数（分组/数组/颜色/下拉）。
- **实测**：浏览器跑通 边缘起步→吃怪升级→Lv12 触发双 Titan 登场→win（吞噬虚空泰坦，VICTORY 结算）与 lose（被碾压，DEFEAT 结算）两版本均验证；config-editor `/__config` schemas+configs API 200。

### 2026-06-12（Session 1）

### 2026-06-12（Session 1）

**完成内容**：
- 项目初始化（Three.js 脚手架 + 补装 art-browser 依赖 cheerio/sharp/p-limit）
- 写完整 spec：game-design 总纲、architecture 架构红线、M0–M5 里程碑、9 个模块 spec
- **M0 技术验证完成并实测通过**：
  - `CameraRig`（3/4 俯视，体型→距离/高度连续插值拉远，pitch≈54° 稳定）
  - `InputController`（任意点摇杆 + WASD 备用）
  - `Hatchling`（GLB 加载路径 + 程序化低面数幼兽回退）
  - `GameScene` 改为 M0 spike（地面/网格/散布树石/光照阴影 + 等级滑条 + 自动成长演示 + FPS/俯角 HUD）
  - 接入 `vite-plugin-singlefile` + `npm run build:single`
  - 浏览器实测：Lv1→Lv405 相机平滑拉远揭示整岛，效果成立（截图验证）
- **体积结论**：单文件 `dist/index.html` ≈ 600KB（gzip 158KB）基线，留给模型/贴图约 4.4MB

- **M1 核心吞噬完成并实测通过**：
  - 逻辑层 `src/logic/`：`CombatSystem`（relation+伤害，移植 2D，纯 TS）、`combat.ts`/`progression.ts` 配置
  - 表现层：`Dragon`（等级/HP/经验/体型）、`Enemy`（relation 轮廓 + 等级差体型）、`LabelLayer`（CSS2D 头顶等级 + 跳字）
  - `GameScene` 重写为 M1 playable：临时刷怪 + 碰撞结算 + 吞噬升级 + 死亡「重玩一次」
  - 实测：自动吃绿怪 Lv1→Lv10（scale 1→1.63）；红怪反伤致死；relation 颜色 26 怪 0 色差；重玩重置正常

**未完成**：
- 真实 GLB 美术资源（当前全程序化占位）；竖屏 UI 细节微调；Draco 解码器本地化（投放前）

## 下次要做

- [ ] 用 art-browser 准备各阶龙 / 敌人 / 泰坦 GLB 替换程序化占位，累积真实资源体积
- [ ] 竖屏（9:16）UI 适配细节 + 触屏手感打磨
- [ ] 投放前：内联 favicon、Draco 解码器本地化、整体体积复核 ≤5MB

## 已知问题

- art-browser 运行时依赖需手动补装（已处理）
- 单文件 ≤5MB 是硬约束：当前基线 600KB，模型/贴图预算 ~4.4MB，M5 需 Draco + 共享贴图
- `dist` 仍有 favicon.svg/icons.svg 小外链（~14KB），M5 单文件化时内联
- 自动化/后台浏览器标签 rAF 会被挂起（FPS 显示 0 是环境假象），本地 `npm run dev` 正常

## 里程碑

| 阶段 | 目标 | 状态 |
|------|------|------|
| 环境搭建 | 项目框架和工具链 | ✅ 完成 |
| 设计 | game-design / architecture / M0–M5 / 模块 spec | ✅ 完成 |
| M0 技术验证 | 相机动态拉远 + 单文件体积 | ✅ 完成 |
| M1 核心吞噬 | 大吃小 + 体型/镜头联动 | ✅ 完成 |
| M2 进化系统 | 多阶 morph + 分支选择 + 特效 | ✅ 完成 |
| M3 世界与敌人 | 环形岛 + 分区刷怪 + 宝箱 | ✅ 完成 |
| M4 终局与转化 | 双 Titan + win/lose + CTA | ✅ 完成 |
| M5 投放打磨 | 音效/性能/Draco/单文件 666KB | ✅ 完成 |
| 配置暴露 | 全参数 JSON + 配置编辑器 schema | ✅ 完成 |
