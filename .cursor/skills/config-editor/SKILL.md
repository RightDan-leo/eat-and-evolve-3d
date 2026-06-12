---
name: config-editor
description: 可视化配置编辑器 + 资源预览器，为游戏 JSON 配置文件生成表单 UI，支持实时编辑 + HMR 热更新，支持项目资源浏览和预览。当用户提到数值编辑器、调数值、配置编辑器、Config Editor、调整游戏参数、编辑配置、打开配置面板、资源预览时使用。
---

# Config Editor（配置编辑器）

项目内置可视化配置编辑器 + 资源预览器，作为 Vite 插件运行，`npm run dev` 后在浏览器访问：

```
http://localhost:5173/__config/
```

## 工具位置

通用工具代码位于本 SKILL.md 同目录下的 `tool/` 子目录，运行时从 `.cursor/skills/` 原地加载（不拷贝到游戏项目）。

```
<本文件所在目录>/tool/
├── plugin.ts    ← Vite 插件（vite.config.ts 直接引用，不拷贝）
├── types.ts     ← Schema 类型定义（schemas.ts 直接引用，不拷贝）
├── preview.ts   ← 3D 模型预览模板（init 时复制到游戏项目，可改）
├── schemas.ts   ← Schema 模板文件（init 时复制到游戏项目）
└── client/      ← 编辑器前端（plugin.ts 直接引用，不拷贝）
```

游戏项目中仅包含用户需要自定义的文件：

```
tools/config-editor/
├── schemas.ts   ← 📝 游戏专属：定义每个 JSON 配置的 UI 规则
└── preview.ts   ← 📝 游戏专属：3D 模型预览（仅 3D 项目，从 skill 复制）
```

## 工作原理

编辑器读取 `schemas.ts` 中的定义，自动为 `src/config/data/*.json` 生成表单 UI。
修改数值 → 保存 → JSON 文件更新 → Vite HMR → 游戏自动热更新。

## 功能概览

### 配置编辑

为 JSON 配置文件生成表单 UI，支持数值滑块、颜色选择器、文本输入、下拉选择、数组表格等。

### 资源预览

自动扫描项目 `assets/` 目录，以卡片网格展示所有图片和 3D 模型资源，点击可放大预览。

### 配置内资源预览

在 schema 中将字符串字段标记为 `asset: true`，编辑器会在该字段旁显示预览按钮，点击即可预览对应的美术资源。

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
      { path: 'sprite', label: '精灵图', type: 'string', asset: true },
      { path: 'model', label: '3D 模型', type: 'string', asset: 'model' },
      { label: '物理', type: 'group', fields: [
        { path: 'physics.gravity', label: '重力', type: 'float', min: 0, max: 2000 },
      ]},
      { path: 'levels', label: '关卡数据', type: 'array', columns: [
        { path: 'name', label: '名称', type: 'string' },
        { path: 'enemies', label: '敌人数', type: 'int', min: 1, max: 100 },
        { path: 'background', label: '背景图', type: 'string', asset: 'image' },
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
| `model_path` | 文本输入 + 预览按钮 | 3D 模型路径（GLB/FBX），需要 preview.ts |
| `asset_path` | 文本输入 + 预览按钮 | 通用美术资源路径 |
| `anim_clip` | 下拉选择 | FBX 动画片段名，自动从模型提取选项 |
| `group` | 可折叠分组 | 嵌套对象分类展示 |
| `array` | 可编辑表格 | 对象数组（需提供 `columns`） |

### asset 属性

`string` 类型的字段可添加 `asset` 属性，标记该字段为美术资源路径：

| asset 值 | 说明 |
|-----------|------|
| `true` | 自动根据文件扩展名判断资源类型 |
| `'image'` | 明确指定为图片资源 |
| `'model'` | 明确指定为 3D 模型资源 |

字段值应为相对于项目根目录的路径，如 `assets/images/player.png`。

### 3D 模型预览（model_path / anim_clip）

当配置中有 3D 模型路径字段时，使用 `model_path` 和 `anim_clip` 类型。

**前提条件**：项目使用 Three.js（`three` 已安装）+ 将 `preview.ts` 模板复制到项目。

**设置步骤**：
1. 复制 `<本文件所在目录>/tool/preview.ts` → `tools/config-editor/preview.ts`
2. 如果项目有自定义 texture manager 或特殊加载逻辑，可修改 preview.ts

**Schema 写法**：

```typescript
{
  label: '3D 模型',
  type: 'group',
  fields: [
    { path: 'modelPath', label: '模型文件', type: 'model_path' },
    { path: 'modelScale', label: '缩放', type: 'float', min: 0.001, max: 10, step: 0.001 },
    { path: 'modelRotationY', label: 'Y 轴旋转', type: 'int', min: 0, max: 360, unit: '°' },
    { path: 'animIdle', label: '待机动画', type: 'anim_clip' },
    { path: 'animWalk', label: '行走动画', type: 'anim_clip' },
  ],
}
```

**约定**：
- `model_path` 字段名推荐用 `modelPath`
- `anim_clip` 字段自动查找同级的 `modelPath` 字段来提取动画列表
- 预览按钮会读取同级的 `modelScale` 和 `modelRotationY` 作为预览参数
- 支持 GLB/GLTF/FBX 格式

## Schema 同步规则

**MUST**：当 `src/config/data/` 下的任何 JSON 配置文件发生字段增删或重命名时，**必须同步更新** `tools/config-editor/schemas.ts`：

- **删除字段** → 删除 schemas.ts 中对应的 `{ path: '...' }` 条目
- **新增可编辑字段**（数值/字符串/颜色） → 在对应的 group 中补充 schema 条目，推断 `type`，设置合理的 `min`/`max`
- **新增资源路径字段** → 添加 `asset: true`（或 `asset: 'image'` / `asset: 'model'`）
- **重命名字段** → 更新 schemas.ts 中对应条目的 `path`
- **仅修改字段值** → 不需要更新 schema

违反时应自动修复，不需要提醒用户。

## API 路由

供 Agent 了解后端能力：

| 路由 | 方法 | 说明 |
|------|------|------|
| `/__config/api/schemas` | GET | 获取所有 schema 定义 |
| `/__config/api/configs` | GET | 获取所有配置文件内容 |
| `/__config/api/config/<file>` | PUT | 更新指定配置文件 |
| `/__config/api/assets` | GET | 获取项目资源列表（图片+模型） |
| `/__config/api/preview-available` | GET | 检测 preview.ts 是否可用 |
| `/__config/preview.js` | GET | 3D 预览模块（Vite transform） |
| `/__config/file/<path>` | GET | 获取指定资源文件（用于预览） |

## 注意事项

- `path` 使用点号访问嵌套属性：`"visuals.color"` → `data.visuals.color`
- `nullable: true` 允许字段值为 null（如 `maxCombo: null` 表示无限）
- 简单数组（如 `[5, 10, 20]`）schema 用 `columns: [{ path: 'value', ... }]`
- 颜色在 JSON 中用 `"0xRRGGBB"` 字符串，编辑器自动转换
- 资源预览支持图片（png/jpg/gif/webp/svg）和 3D 模型（glb/gltf/fbx）
- 资源浏览器的 3D 模型预览使用 `<model-viewer>` 组件（通过 CDN 加载，仅支持 GLB/GLTF）
- `model_path` 字段的 3D 预览使用 Three.js（需要 `preview.ts`，支持 GLB/GLTF/FBX）
- 如果项目不需要 3D 模型预览，无需复制 preview.ts，`model_path`/`anim_clip` 字段仍可正常编辑
