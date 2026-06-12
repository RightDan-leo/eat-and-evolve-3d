# 跨模块任务工作流

当任务涉及 3 个或以上不同领域的修改时使用此流程。

> **与 Task 工作流的关系**：跨模块任务 MUST 使用 task spec 来组织和追踪进度。本文档定义领域划分和拆分原则，task spec 负责具体的变更范围和实施计划记录。两者配合使用。

## 领域划分

| 领域 | 示例 |
|------|------|
| 美术资源 | 模型文件、贴图、动画 |
| 场景视觉 | 光照、材质、雾效、天空盒、背景 |
| UI / HUD | 样式、布局、尺寸、交互 |
| 游戏逻辑 | 实体行为、系统规则、状态机 |
| 配置结构 | JSON 字段增删、Schema 变更 |
| 引擎 / 渲染 | 后处理、相机、物理、渲染管线 |

## 执行流程

```
1. 调研
   - 读取 PROJECT_STATUS.md + specs/_index.md
   - 调研涉及的各模块现状（代码/配置/资源）
   - 明确需要改动的领域和范围

2. 创建 Task Spec
   /spec-driven-dev init "任务描述" --template task
   - 在 task spec 中记录所有受影响的领域和模块
   - 制定按依赖顺序的实施计划
   - 定义验收标准

3. Spec 拆分
   - 为每个涉及的主要领域创建/更新 feature spec
   - 使用 spec-driven-dev SKILL 的 feature 模板
   - 每个 feature spec 挂载到对应的父 spec 下
   - 更新 specs/_index.md（Task Specs 表 + Feature Specs 表 + 总览统计）

4. ⏸️ STOP — 展示 task spec 摘要和 feature spec 列表，等待用户确认

5. 编码（用户确认后）
   - 按 task spec 中实施计划的顺序执行
   - 每完成一步，在 task spec 中勾选 ✅
   - 每完成一个模块走正常的 sync 流程

6. 验收
   - 逐项检查 task spec 的验收标准
   - task spec 状态改为 completed
   - 更新 PROJECT_STATUS.md
```

## Spec 拆分原则

- **一个领域一个 feature spec**：不要把场景改造和 UI 调整塞进同一个 spec
- **挂载到最相关的父 spec**：场景相关 → `pit3d.spec.md`，UI 相关 → `hud.spec.md`
- **复用已有 feature spec**：如果某领域已有 draft/implementing 的 feature spec，更新它而非新建
- **需求分解要具体**：每个 checklist 项应可独立验证（如「XP 条高度从 6px 增到 10px」而非「优化 XP 条」）

## 例外（不触发此流程）

- 任务虽涉及多文件但属于同一领域内部（如跨文件重命名、统一代码风格）
- 纯数值微调（只改 config JSON 的数字，不涉及结构变更）
- 单模块的增量功能（走 `sdd-workflows.md` 的「增量功能开发流程」即可）
