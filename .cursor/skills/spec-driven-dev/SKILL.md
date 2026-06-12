---
name: spec-driven-dev
description: Spec-Driven Development 工作流。创建规格文档、从 spec 生成代码、同步代码到 spec、验证 spec 覆盖率。当用户提到 spec、SDD、规格文档、从 spec 生成代码、同步 spec 时使用。也在用户要求开发新里程碑或新模块时自动触发——先检查/创建 spec。
---

# Spec-Driven Development (SDD)

先定义 spec，再实现代码，保持文档与代码同步。

## 模式速查

| 模式 | 用途 | 示例 |
|------|------|------|
| `init` | 创建 spec | `init "玩家角色" --template entity` |
| `init` | 创建任务 spec | `init "修改战斗机制" --template task` |
| `start` | 从 spec 生成代码 | `start src/entities/Player.ts` 或 `start M1` 或 `start task:xxx` |
| `sync` | 代码变更同步回 spec | `sync src/entities/Player.ts` |
| `add` | 为模块添加功能 spec | `add src/entities/Player.ts "二段跳"` |
| `archive` | 归档功能 spec 到主 spec | `archive src/entities/Player.ts double-jump` |
| `validate` | 检查 spec 覆盖率 | `validate` |

参数：`$MODE` + `$TARGET`（路径或描述） + `$TEMPLATE`（可选）

## 按需读取详细文档

> **不要一次性读取所有文档。** 根据当前任务只读对应内容。

| 需要做什么 | 读取 |
|-----------|------|
| 执行某个模式（init/start/sync 等） | 用 split-read 读取对应 section：`node .cursor/split-read.mjs <SKILL_DIR>/sdd-modes.md --section "init"` |
| 了解 spec 存放位置、层级、格式 | 读取 [sdd-specs.md](sdd-specs.md) |
| 查看工作流模式（里程碑/任务/单模块/增量） | 读取 [sdd-workflows.md](sdd-workflows.md) |
| 跨模块任务（3+ 领域同时修改） | 读取 [sdd-cross-module.md](sdd-cross-module.md) |
| 查看 spec 模板 | 读取 `templates/` 目录下对应模板文件 |

其中 `<SKILL_DIR>` 是本 SKILL.md 所在目录的绝对路径。

---

## 注意事项

1. **⚠️ 用户确认门控（最高优先级）**：创建/修改 spec 后，**MUST STOP 并等待用户明确确认**，NEVER 自动进入编码阶段。只有用户回复「开始编码」「确认」「LGTM」「可以」「继续」等明确肯定指令后，才能调用 start 模式写代码。**这条规则优先级高于一切，即使用户最初的指令看似包含"开发"二字。**
2. **spec 优先**：冲突时以 spec 为准，代码应符合 spec 定义
3. **及时同步**：代码变更后应及时 sync，保持文档与代码一致
4. **需求变更双向同步**：当用户在对话中提出需求变更时，必须**同时更新 spec 和代码**，不能只改一边。流程：先改 spec → 再改代码 → 确认两边一致
5. **关联维护**：修改 spec 时注意更新 `related` 字段和索引文件
6. **状态更新**：操作完成后自动更新状态，无需手动修改
7. **模板选择**：绿地开发时优先使用特化模板（milestone/task/scene/entity/system），描述更精准
8. **里程碑驱动**：大型功能开发 MUST 通过里程碑 spec 组织，不要直接跳到模块编码
9. **任务驱动**：跨模块修改（非里程碑）MUST 通过任务 spec 组织。区分：milestone 用于新增阶段（从无到有），task 用于修改已有系统（从有到优）
9. **外部依赖查阅策略**：当需要了解外部模块/系统的接口时，**优先读取其 spec 的公开接口区**（`<!-- INTERNAL -->` 标记之前），而非读完整 spec 或源码。使用 `split-read` 工具只读公开接口区：
   ```bash
   node .cursor/split-read.mjs specs/entities/Player.spec.md --before "<!-- INTERNAL -->"
   ```
   仅在以下情况才读取完整 spec 或源码：
   - Spec 不存在（该模块无 spec）
   - Spec 状态为 `draft`（内容可能不完整）
   - 需要调试具体实现细节
   - 公开接口区信息不足以完成当前任务
10. **文件拆分策略**：当代码文件超过 **500 行**时，应主动建议拆分。拆分规则：
    - **按职责拆分**：将不同职责域提取到子模块文件，放在同名子目录下（如 `Player.ts` → `Player.ts` + `player/Movement.ts` + `player/Combat.ts`）
    - **主文件作为 facade**：主文件组合子模块，对外暴露统一接口
    - **Spec 同步拆分**：每个子模块文件对应一个子 spec（如 `specs/entities/player/Movement.spec.md`）
    - **主 spec 聚合接口**：主 spec 的公开接口区 MUST 汇总所有子模块的公开方法，外部模块只需读主 spec 即可了解完整接口
    - **子 spec 仅供内部开发**：外部模块 NEVER 需要读取子 spec
