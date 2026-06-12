# SDD 工作流模式

## 里程碑开发流程（推荐）

```
1. /spec-driven-dev init "M1 核心战斗原型" --template milestone   # 创建里程碑 spec
2. 根据里程碑 spec 中的模块列表，逐一创建模块 spec：
   /spec-driven-dev init src/entities/Player.ts --template entity
   /spec-driven-dev init src/entities/Enemy.ts --template entity
   ...
3. ⏸️ STOP — 向用户展示 spec 摘要，等待用户 review 和确认
4. 用户确认后 → /spec-driven-dev start M1                         # 按顺序逐模块生成代码
5. 运行验证
6. /spec-driven-dev sync 有变更的模块                               # 同步变更
```

## 任务开发流程（跨模块修改）

用于非里程碑但涉及多模块的修改（如：调整战斗机制、重构移动系统、优化渲染管线）。

**何时使用 task 而非 milestone：**
- **Milestone**：新增一组模块、开启新的开发阶段（从无到有）
- **Task**：修改已有系统、跨模块调整逻辑（从有到优）

```
1. 调研
   - 读取 PROJECT_STATUS.md + specs/_index.md
   - 读取受影响模块的 spec 公开接口区
   - 明确变更范围和影响

2. 创建 task spec
   /spec-driven-dev init "修改战斗机制" --template task
   - 填充变更范围（受影响模块、配置、接口变更）
   - 制定按序实施计划
   - 定义验收标准

3. 为每个受影响模块创建/更新 feature spec
   /spec-driven-dev add src/entities/Player.ts "战斗伤害计算改为百分比"
   /spec-driven-dev add src/systems/Combat.ts "支持护甲减伤"
   （单纯数值调整不需要 feature spec）

4. ⏸️ STOP — 向用户展示：
   - task spec 摘要（目标、变更范围、实施计划）
   - 各 feature spec 要点
   - 等待用户 review 和确认

5. 编码（用户确认后）
   - 按 task spec 中的实施计划顺序执行
   - 每完成一步，在 task spec 中勾选 ✅
   - 每个模块完成后 sync 对应 spec

6. 验收
   - 逐项检查验收标准
   - task spec 状态改为 completed
   - 更新 PROJECT_STATUS.md
```

## 单模块开发流程

```
1. /spec-driven-dev init "功能描述" --template scene|entity|system  # 创建模块 spec
2. ⏸️ STOP — 等待用户 review spec 并确认
3. 用户确认后 → /spec-driven-dev start src/xxx/Xxx.ts              # 从 spec 生成代码
4. （运行验证）
5. /spec-driven-dev sync src/xxx/Xxx.ts                             # 同步变更
```

## 增量功能开发流程

```
1. /spec-driven-dev add src/entities/Player.ts "支持二段跳"   # 创建功能 spec
2. ⏸️ STOP — 等待用户 review spec 并确认
3. 用户确认后 → /spec-driven-dev start src/entities/Player.ts # 实现代码
4. （开发调试）
5. /spec-driven-dev archive src/entities/Player.ts double-jump # 归档
```

## 棕地补文档流程

```
1. /spec-driven-dev sync src/existing-code.ts     # 从代码生成 spec
2. （人工完善 spec）
```

## 定期检查

```
/spec-driven-dev validate   # 查看覆盖率和里程碑进度
```
