import type { ConfigSchema } from '../../.cursor/skills/config-editor/tool/types';

/**
 * 配置编辑器 Schema 定义
 *
 * 在此定义 src/config/data/*.json 中每个配置文件的 UI 渲染规则。
 * 每添加一个新的 JSON 配置文件，就在此处添加对应的 schema。
 *
 * 字段类型：
 *   int    — 整数，渲染为滑块 + 输入框
 *   float  — 浮点数，渲染为滑块 + 输入框
 *   color  — 颜色（0xRRGGBB），渲染为颜色选择器
 *   string — 文本，渲染为输入框（可添加 asset 属性启用资源预览）
 *   select — 下拉选择
 *
 * 特殊类型：
 *   group  — 字段分组（可折叠），用于组织相关字段
 *   array  — 数组/表格，用于编辑对象数组
 *
 * asset 属性（用于 string 类型）：
 *   true     — 自动检测资源类型
 *   'image'  — 图片资源
 *   'model'  — 3D 模型资源
 *
 * 示例用法（取消注释并按需修改）：
 *
 * {
 *   file: 'player.json',
 *   label: '玩家',
 *   icon: '⚾',
 *   fields: [
 *     { path: 'speed', label: '移动速度', type: 'int', min: 50, max: 500, unit: 'px/s' },
 *     { path: 'visuals.color', label: '颜色', type: 'color' },
 *     { path: 'sprite', label: '精灵图', type: 'string', asset: true },
 *     {
 *       label: '外观',
 *       type: 'group',
 *       fields: [
 *         { path: 'visuals.color', label: '颜色', type: 'color' },
 *       ],
 *     },
 *     {
 *       path: 'abilities',
 *       label: '技能列表',
 *       type: 'array',
 *       columns: [
 *         { path: 'name', label: '名称', type: 'string' },
 *         { path: 'damage', label: '伤害', type: 'int', min: 0, max: 100 },
 *         { path: 'cooldown', label: '冷却', type: 'int', min: 100, max: 10000, unit: 'ms' },
 *         { path: 'icon', label: '图标', type: 'string', asset: 'image' },
 *       ],
 *     },
 *   ],
 * },
 */
export const schemas: ConfigSchema[] = [];
