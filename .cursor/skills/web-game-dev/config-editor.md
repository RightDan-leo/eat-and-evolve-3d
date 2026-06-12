# Config Editor（数值编辑器）

项目内置可视化数值编辑器，`npm run dev` 后在浏览器访问：

```
http://localhost:5173/__config/
```

## 工作原理

```
tools/config-editor/
├── index.ts       ← Vite 插件（通用，不改）
├── types.ts       ← Schema 类型定义（通用，不改）
├── schemas.ts     ← 📝 游戏专属：定义每个 JSON 配置的 UI 规则
└── client/        ← 编辑器前端（通用，不改）
```

编辑器读取 `schemas.ts` 中的定义，自动为 `src/config/data/*.json` 生成表单 UI。
修改数值 → 保存 → JSON 文件更新 → Vite HMR → 游戏自动热更新。

## 添加新配置到编辑器

当你创建新的 `src/config/data/xxx.json` 配置文件时，同步在 `tools/config-editor/schemas.ts` 添加对应 schema：

```typescript
import type { ConfigSchema } from './types';

export const schemas: ConfigSchema[] = [
  {
    file: 'xxx.json',       // JSON 文件名
    label: '配置名',         // 侧栏显示名
    icon: '🎮',             // 侧栏图标
    fields: [
      { path: 'speed', label: '速度', type: 'int', min: 0, max: 500, unit: 'px/s' },
      { path: 'visuals.color', label: '颜色', type: 'color' },
      { label: '物理', type: 'group', fields: [
        { path: 'physics.gravity', label: '重力', type: 'float', min: 0, max: 2000 },
      ]},
      { path: 'levels', label: '关卡数据', type: 'array', columns: [
        { path: 'name', label: '名称', type: 'string' },
        { path: 'enemies', label: '敌人数', type: 'int', min: 1, max: 100 },
      ]},
    ],
  },
];
```

## Schema 字段类型

| type | 渲染方式 | 适用场景 |
|------|---------|---------|
| `int` | 滑块 + 数字输入 | 整数值（HP、伤害、间隔 ms） |
| `float` | 滑块 + 数字输入 | 浮点值（速度、比例、透明度） |
| `color` | 颜色选择器 | 颜色值（`0xRRGGBB` 格式） |
| `string` | 文本输入 | 字符串（名称、key） |
| `select` | 下拉菜单 | 枚举值（需提供 `options`） |
| `group` | 可折叠分组 | 嵌套对象分类展示 |
| `array` | 可编辑表格 | 对象数组（需提供 `columns`） |

## Schema 同步规则

**MUST**：当 `src/config/data/` 下的任何 JSON 配置文件发生字段增删或重命名时，**必须同步更新** `tools/config-editor/schemas.ts`：

- **删除字段** → 删除 schemas.ts 中对应的 `{ path: '...' }` 条目
- **新增可编辑字段**（数值/字符串/颜色） → 在对应的 group 中补充 schema 条目，推断 `type`，设置合理的 `min`/`max`
- **重命名字段** → 更新 schemas.ts 中对应条目的 `path`
- **仅修改字段值** → 不需要更新 schema

违反时应自动修复，不需要提醒用户。

## 注意事项

- `path` 使用点号访问嵌套属性：`"visuals.color"` → `data.visuals.color`
- `nullable: true` 允许字段值为 null（如 `maxCombo: null` 表示无限）
- 简单数组（如 `[5, 10, 20]`）schema 用 `columns: [{ path: 'value', ... }]`
- 颜色在 JSON 中用 `"0xRRGGBB"` 字符串，编辑器自动转换
