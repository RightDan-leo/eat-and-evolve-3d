/**
 * Config Editor Schema 类型定义
 *
 * 用于描述 JSON 配置文件中每个字段的编辑器 UI 渲染方式。
 * 这些类型是通用的，适用于任何游戏项目。
 */

/** 基础字段定义 */
export interface FieldDef {
  path: string;
  label: string;
  type: 'int' | 'float' | 'color' | 'string' | 'select' | 'model_path' | 'asset_path' | 'anim_clip';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** 是否允许 null 值（如 maxCombo: null 表示无限） */
  nullable?: boolean;
  /** select 类型的选项列表 */
  options?: { value: string; label: string }[];
  /** 标记该字段为美术资源路径，启用预览按钮。true 自动检测，或指定 'image' | 'model' */
  asset?: boolean | 'image' | 'model';
}

/** 分组定义（UI 上渲染为可折叠区域） */
export interface GroupDef {
  label: string;
  type: 'group';
  fields: AnyFieldDef[];
}

/** 数组定义（UI 上渲染为可编辑表格） */
export interface ArrayDef {
  path: string;
  label: string;
  type: 'array';
  columns: FieldDef[];
}

export type AnyFieldDef = FieldDef | GroupDef | ArrayDef;

/** 单个配置文件的 schema */
export interface ConfigSchema {
  /** JSON 文件名（如 'player.json'） */
  file: string;
  /** 分类显示名 */
  label: string;
  /** 侧栏图标（emoji） */
  icon: string;
  /** 字段/分组/数组定义列表 */
  fields: AnyFieldDef[];
}
