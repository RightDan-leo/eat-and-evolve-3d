---
target: src/core/{ComponentName}.ts
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
status: draft
engine: 2d | 3d | both
related: []
---

# {组件名称}

## 概述

{组件的职责，1-2 句话}

## 适用场景

- {何时应该使用此组件}

## 公开接口

```typescript
interface I{ComponentName} {
  // 核心方法
}
```

### 构造 / 初始化

```typescript
const xxx = new {ComponentName}(options);
```

### 方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| | | | |

### 配置项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| | | | |

## 用法示例

```typescript
// 典型使用场景
```

## 依赖

### 引用模块
- {依赖}

### 被引用
- {被依赖}

<!-- INTERNAL -->

## 实现策略

{内部实现的核心思路}

## 性能特性

{时间/空间复杂度、GC 影响、帧预算等}

## 设计取舍

{为什么选择这种实现方式、考虑过但放弃的方案}

## 备注

{注意事项}
