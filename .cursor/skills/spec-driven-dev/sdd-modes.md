# SDD 操作模式详细定义

<!-- section:init -->
## 模式 1: init - 创建 Spec

**用途**：根据功能描述创建新的 spec 文件

**参数**：
- `$TARGET` - 功能描述文本，或代码文件路径
- `$TEMPLATE` -（可选）模板类型：`default` | `milestone` | `task` | `scene` | `entity` | `system` | `game-design`

**执行步骤**：

1. 确定 spec 类型：
   - 用户指定了 `$TEMPLATE`：使用对应模板
   - 用户给出代码文件路径：从路径推断类型（`scenes/` → scene，`entities/` → entity，`systems/` → system）
   - 用户提到"里程碑"、"M1"、"阶段"等：使用 `milestone` 模板
   - 用户提到"任务"、"修改...机制"、"调整...系统"、"重构"等跨模块修改：使用 `task` 模板
   - 其他：使用 `default` 模板

2. 确定目标路径：
   - 里程碑 spec：`specs/milestones/mX-{短名}.spec.md`
   - 任务 spec：`specs/tasks/{短名}.spec.md`
   - 从代码路径推断：`src/scenes/GameScene.ts` → `specs/scenes/GameScene.spec.md`
   - 从功能描述推断：分析描述，确定合适的目录和文件名

3. 读取对应模板文件 `specs/_templates/{template}.spec.md`

4. 根据用户描述和 `game-design.spec.md` 中的相关内容填充模板，生成 spec 文件

5. 更新索引文件 `specs/_index.md`

**示例**：
```
/spec-driven-dev init "实现玩家角色，支持移动、跳跃和受伤" --template entity
/spec-driven-dev init src/scenes/GameScene.ts
/spec-driven-dev init "游戏整体设计" --template game-design
/spec-driven-dev init "M1 核心战斗原型" --template milestone
/spec-driven-dev init "修改战斗伤害计算" --template task
```

**task 模板特殊处理**：

创建 task spec 时，需额外执行以下步骤：

1. 读取受影响模块的 spec（公开接口区），分析当前接口和逻辑
2. 填充「变更范围」表格：列出所有受影响的模块、配置文件、接口变更
3. 制定「实施计划」：按依赖顺序排列步骤，每步应可独立验证
4. 更新 `specs/_index.md` 的 Task Specs 表
5. 为每个需要修改逻辑的模块创建 feature spec（纯数值调整不需要）

<!-- /section:init -->

<!-- section:start -->
## 模式 2: start - 从 Spec 生成/更新代码

**用途**：根据 spec 定义生成代码，或更新现有代码以符合 spec

**重要**：此模式只从 spec → 代码，不要反向修改 spec

**参数**：
- `$TARGET` - 代码文件路径（如 `src/entities/Player.ts`）、里程碑标识（如 `M1`）或任务标识（如 `task:combat-rebalance`）

**执行步骤**：

**当 $TARGET 是任务标识时（`task:xxx` 或 task spec 路径）：**

1. 读取任务 spec（`specs/tasks/xxx.spec.md`）
2. 检查 task spec 状态必须为 `ready` 或 `implementing`
3. 检查「变更范围」中列出的各模块是否有对应的 feature spec
4. 对缺失的 feature spec → 先创建
5. **所有 spec 就绪后 → STOP，向用户展示 task 摘要（目标、变更范围、实施计划、feature spec 列表），等待用户明确确认后再继续**
6. **NEVER 在用户确认前开始写代码。这是硬性门控。**
7. 用户确认后，按 task spec 中「实施计划」的顺序逐步执行
8. 每完成一步，在 task spec 中勾选对应的实施步骤（`- [x]`）
9. 每个模块完成后执行 sync 同步 spec
10. 全部完成后，逐项检查验收标准，将所有实施计划和验收标准的 `- [ ]` 标记为 `- [x]`，task spec 状态改为 `completed`

**当 $TARGET 是里程碑标识时：**

1. 读取里程碑 spec（`specs/milestones/mX-xxx.spec.md`）
2. 如果里程碑 spec 不存在 → 创建里程碑 spec + 所有模块 spec
3. 检查里程碑 spec 状态必须为 `ready` 或 `implementing`
4. 按里程碑中定义的开发顺序，逐一检查每个模块 spec 是否存在且状态为 `ready`
5. 对缺失的模块 spec → 先创建
6. **所有 spec 就绪后 → STOP，向用户展示 spec 摘要（里程碑目标、验收标准、模块列表、开发顺序），等待用户明确说「开始编码」「确认」「LGTM」等确认指令后再继续**
7. **NEVER 在用户确认前开始写代码。这是硬性门控。**
8. 用户确认后，按顺序对每个模块执行 start 流程
9. 所有模块完成后，将里程碑 spec 的验收标准全部标记为 `- [x]`，状态改为 `completed`

**当 $TARGET 是代码文件路径时：**

1. 读取对应的 spec 文件（从代码路径映射到 spec 路径）

2. 检查 spec 状态：
   - `draft`：提示用户完善 spec 后再生成
   - `ready` / `implementing`：继续执行

3. 检查目标代码文件：
   - **不存在**：根据 spec 生成完整代码
   - **存在**：对比 spec 与现有代码，进行增量更新

4. 生成代码时遵循项目规范：
   - 读取项目中的 rules（如有）
   - 参考 `src/types/` 下的类型定义
   - 遵循项目现有的代码风格

5. 更新 spec 状态为 `implementing`

6. 代码生成后，标记已完成的功能需求（`- [ ]` → `- [x]`）

7. 如果所有功能需求均已完成，将 spec 状态改为 `completed`，并确保所有 `- [ ]` 都已标记为 `- [x]`

**示例**：
```
/spec-driven-dev start M1                           # 按里程碑开发
/spec-driven-dev start task:combat-rebalance        # 按任务开发
/spec-driven-dev start src/entities/Player.ts        # 单模块开发
/spec-driven-dev start src/scenes/GameScene.ts
```
<!-- /section:start -->

<!-- section:sync -->
## 模式 3: sync - 从代码同步到 Spec

**用途**：将代码变更反向同步到 spec，或为现有代码创建 spec

**参数**：
- `$TARGET` - 代码文件路径（可选，默认为当前打开的文件）
- `$FEATURE_NAME` - 功能名（可选，指定时同步到功能 spec）

**执行步骤**：

1. 读取目标代码文件

2. 确定同步目标：
   - **指定了 `$FEATURE_NAME`**：同步到功能 spec
     - 路径：`specs/{目录}/{文件名}/features/{feature-name}.spec.md`
     - 如果功能 spec 不存在，报错提示
   - **未指定**：同步到主 spec
     - 路径：`specs/{代码 src/ 之后的相对路径}.spec.md`

3. 检查目标 spec 是否存在：
   - **不存在**（主 spec）：分析代码结构，生成新的 spec
   - **不存在**（功能 spec）：报错，需先用 add 模式创建
   - **存在**：对比代码与 spec，更新：
     - 功能需求状态（已实现的标记为 `- [x]`，未实现的保持 `- [ ]`）
     - 接口定义（新增/修改的方法）
     - 依赖关系

4. 更新 spec 的 `updated` 时间戳

5. 如果所有功能需求均已标记为 `- [x]`，将 spec 状态改为 `completed`

6. 如果该模块属于某个里程碑，同时更新里程碑 spec 中的完成状态

**示例**：
```
/spec-driven-dev sync src/entities/Player.ts
/spec-driven-dev sync                           # 同步当前文件
/spec-driven-dev sync src/entities/Player.ts double-jump  # 同步到功能 spec
```
<!-- /section:sync -->

<!-- section:add -->
## 模式 4: add - 创建独立功能 Spec

**用途**：为新功能创建独立的 spec 文件，并在主 spec 中关联

**参数**：
- `$TARGET` - 代码文件路径（可选，默认为当前打开的文件）
- `$FEATURE` - 功能描述文本

**执行步骤**：

1. 检查主 spec 是否存在：
   - **不存在**：先执行 sync 模式为代码生成主 spec

2. 读取目标代码文件（如存在），分析是否已具有描述的功能：
   - **已存在**：提示用户，在主 spec 中标记为 `[x]`
   - **不存在**：继续下一步

3. 生成功能名（feature name）：
   - 从功能描述提取简短的英文标识符
   - 格式：小写字母 + 连字符，如 `double-jump`、`particle-effect`

4. 创建独立功能 spec 文件：
   - 路径：`specs/{代码目录}/{代码文件名}/features/{feature-name}.spec.md`
   - 使用功能 spec 模板

5. 更新主 spec：
   - 在 `related` 字段添加功能 spec 路径
   - 在功能需求中添加：`- [ ] {描述} → [详细规范](features/{feature-name}.spec.md)`
   - 如果状态为 `completed`，改为 `implementing`

**示例**：
```
/spec-driven-dev add src/entities/Player.ts "支持二段跳"
/spec-driven-dev add "支持粒子特效"  # 为当前文件添加
```
<!-- /section:add -->

<!-- section:archive -->
## 模式 5: archive - 归档功能 Spec 到主 Spec

**用途**：将独立功能 spec 精简合并到主 spec，删除功能 spec 文件

**参数**：
- `$TARGET` - 代码文件路径（可选，默认为当前打开的文件）
- `$FEATURE_NAME` - 功能名

**执行步骤**：

1. 定位功能 spec 文件

2. 检查功能 spec 状态：
   - 不是 `completed` 时，询问用户是否确认归档

3. 提取关键内容（接口定义、数据结构、业务逻辑）

4. 合并到主 spec 的对应章节

5. 清理：
   - 移除 `related` 中的引用
   - 删除功能 spec 文件
   - 功能需求改为 `- [x] {描述}`
   - 更新时间戳

**示例**：
```
/spec-driven-dev archive src/entities/Player.ts double-jump
```
<!-- /section:archive -->

<!-- section:validate -->
## 模式 6: validate - 检查 Spec 覆盖率

**用途**：检查 spec 与代码的一致性和覆盖率

**参数**：
- `$TARGET` -（可选）指定目录或文件，默认全项目扫描

**执行步骤**：

1. 先运行 `git diff --name-only` 获取变更文件列表，优先检查变更文件的 spec 覆盖率和一致性。仅在用户明确要求全量扫描或无变更文件时，才遍历整个 `src/` 目录

2. 检查每个代码文件是否有对应的 spec

3. 检查每个里程碑和任务 spec 的完成度

4. 对已有 spec 的文件，检查：
   - spec 状态是否过期（代码已改但 spec 未更新）
   - 功能需求的完成度
   - 接口定义是否匹配

5. 输出报告：

```
📊 Spec 覆盖率报告

总代码文件：12
有 spec 的：8 (66.7%)
无 spec 的：4

📌 里程碑进度：
  - M1 核心战斗：3/5 模块完成
  - M2 体力得分：0/4 模块完成

📋 任务进度：
  - 战斗数值重平衡：2/4 步骤完成
  - 移动系统重构：completed

⚠️  需要关注：
  - src/entities/Enemy.ts — 无 spec
  - src/systems/Scoring.ts — 无 spec
  - src/scenes/GameScene.ts — spec 状态 implementing，2 项未完成

✅ 状态良好：
  - src/entities/Player.ts — completed
  - src/scenes/MainMenuScene.ts — completed
```

**示例**：
```
/spec-driven-dev validate
/spec-driven-dev validate src/entities/
```
<!-- /section:validate -->
