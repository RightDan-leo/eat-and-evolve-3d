# Art Browser 疑难排解

## 下载阶段

### 问题 0：Poly Pizza 通过 Art Browser API 下载失败（404）

**现象**：通过 Art Browser 的 `/api/download-start` 下载 Poly Pizza 模型时返回 404，`Invoke-WebRequest` 直接下载也失败，`models.poly.pizza` 域名 DNS 解析失败。

**根因**：Poly Pizza 的 CDN 域名和 URL 结构会变动，Art Browser 内置的下载逻辑可能使用了过时的 URL 模式。

**解决（手动下载脚本）**：

1. 先访问模型页面 `https://poly.pizza/m/{modelId}` 获取 HTML
2. 从 HTML 中提取实际的 GLB 直链（通常为 `https://static.poly.pizza/{hash}.glb`，在 `<meta>` 标签或 JSON-LD 中）
3. 用提取到的直链下载 GLB 文件

```javascript
// scripts/download-model.mjs
import https from 'https';
import fs from 'fs';
import path from 'path';

const modelId = process.argv[2];
const targetDir = process.argv[3];

// Step 1: 获取模型页面，提取 GLB 直链
const pageUrl = `https://poly.pizza/m/${modelId}`;
const html = await fetch(pageUrl).then(r => r.text());
const match = html.match(/https:\/\/static\.poly\.pizza\/[^"'\s]+\.glb/i);
if (!match) throw new Error('GLB URL not found in page');

// Step 2: 下载 GLB
const glbUrl = match[0];
const fileName = path.basename(glbUrl);
const dest = path.join(targetDir, fileName);
fs.mkdirSync(targetDir, { recursive: true });

const res = await fetch(glbUrl);
const buffer = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(dest, buffer);
console.log(`Downloaded: ${dest} (${buffer.length} bytes)`);
```

**建议**：下载完成后验证文件头是否为有效 GLB（前 4 字节应为 `glTF`）。

---

## 加载阶段

从资源站下载的 GLB 模型在 Three.js 中加载后，常见三类问题及解决方案。

## 问题 1：模型不可见（实际已加载）

**根因**：模型原点不在几何中心，导致模型偏移到视野外或埋入地面。许多美术资源的原点在脚底、模型边缘、甚至远离模型本体。

**解决**：加载后用 mesh-only bounding box 重新居中：

```typescript
model.updateMatrixWorld(true);
const box = new THREE.Box3();
model.traverse((child) => {
  if ((child as THREE.Mesh).isMesh) {
    const geo = (child as THREE.Mesh).geometry;
    if (geo) {
      geo.computeBoundingBox();
      if (geo.boundingBox) {
        const b = geo.boundingBox.clone();
        b.applyMatrix4(child.matrixWorld);
        box.union(b);
      }
    }
  }
});
const center = new THREE.Vector3();
box.getCenter(center);
model.position.set(-center.x, -box.min.y, -center.z);
```

**注意**：不要用 `Box3.setFromObject(model)`——它会把骨骼（Bone）、辅助对象（Helper）等非可视节点也算进 bounding box，导致范围异常大。必须只遍历 `isMesh` 的子节点。

## 问题 2：模型过大或过小

**根因**：不同资源站的模型没有统一尺寸标准，原始尺寸可能从 0.1 到 100+ 不等。

**解决**：基于 mesh bounding box 自动适配到目标碰撞半径：

```typescript
const size = new THREE.Vector3();
box.getSize(size);
const maxDim = Math.max(size.x, size.y, size.z);
if (maxDim > 0) {
  const fitScale = (desiredDiameter) / maxDim;
  model.scale.setScalar(fitScale * userScaleMultiplier);
}
```

其中 `userScaleMultiplier` 暴露为配置项（默认 1.0），方便微调。

## 问题 3：克隆后模型消失或变形

**根因**：含骨骼动画的模型（SkinnedMesh）用普通 `.clone()` 克隆时，骨骼绑定关系会断裂，顶点塌缩到原点。

**解决**：使用 `SkeletonUtils.clone()` 替代：

```typescript
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const clone = SkeletonUtils.clone(preloadedModel) as THREE.Group;
```

`SkeletonUtils.clone()` 会正确重建克隆体的骨骼层级和绑定关系。**即使模型当前没有播放动画，只要 GLB 内含 Armature/Skeleton 结构就必须用此方法。**

## 推荐的完整预加载流程

```
加载 GLB → mesh-only bbox 计算 → 自动缩放到目标尺寸 → XZ 居中 + Y 贴地 → 存为 preloadedModel
创建实体时 → SkeletonUtils.clone(preloadedModel) → 添加到场景
```
