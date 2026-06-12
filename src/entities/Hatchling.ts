import * as THREE from 'three';
import { loadAndNormalizeGLB } from '../core/ModelUtils';

export interface CreatureColors {
  body: number;
  accent: number;
  /** 造型档位：越高角/翼越多（形态越高级） */
  tier?: number;
}

/**
 * 创建幼兽/龙模型。优先加载 GLB（若存在），否则用程序化低面数模型回退，
 * 保证无美术资源时也能跑通管线并体现多阶形态。
 */
export async function createHatchling(
  glbUrl?: string,
  colors: CreatureColors = { body: 0x3b82f6, accent: 0x1e40af, tier: 0 },
): Promise<THREE.Group> {
  if (glbUrl) {
    try {
      const { scene } = await loadAndNormalizeGLB(glbUrl, { targetSize: 1.4, centerAndGround: true });
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.castShadow = true;
      });
      const group = new THREE.Group();
      group.add(scene);
      group.userData.source = 'glb';
      return group;
    } catch {
      /* 资源缺失 → 回退程序化模型 */
    }
  }
  const group = buildCreature(colors);
  group.userData.source = 'procedural';
  return group;
}

/** 程序化低面数龙（身体/肚皮/头/眼/角/翼/尾/脚），grounded 于 y=0；tier 越高造型越夸张 */
export function buildCreature(colors: CreatureColors): THREE.Group {
  const tier = colors.tier ?? 0;
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.6, metalness: 0.05, flatShading: true });
  const bellyMat = new THREE.MeshStandardMaterial({ color: mix(colors.body, 0xffffff, 0.5), roughness: 0.7, flatShading: true });
  const accentMat = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.5, flatShading: true });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), bodyMat);
  body.scale.set(1.0, 0.9, 1.15);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), bellyMat);
  belly.scale.set(0.9, 0.8, 0.7);
  belly.position.set(0, 0.5, 0.42);
  g.add(belly);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), bodyMat);
  head.position.set(0, 1.12, 0.5);
  head.castShadow = true;
  g.add(head);

  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
    eye.position.set(0.16 * sx, 1.2, 0.82);
    g.add(eye);
  }

  // 头顶角：tier 越高越多
  const hornCount = 1 + tier;
  for (const sx of [-1, 1]) {
    for (let h = 0; h < hornCount; h++) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26 + tier * 0.05, 6), accentMat);
      horn.position.set(0.16 * sx, 1.5 + h * 0.18, 0.42 - h * 0.12);
      horn.rotation.x = -0.3;
      g.add(horn);
    }
  }

  // 翅膀：tier 越高越大
  const wingScale = 1 + tier * 0.35;
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), accentMat);
    wing.position.set(0.6 * sx, 0.85, -0.1);
    wing.rotation.set(0, 0, (Math.PI / 2.4) * -sx);
    wing.scale.set(0.5 * wingScale, 1 * wingScale, 1);
    g.add(wing);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7 + tier * 0.1, 6), bodyMat);
  tail.position.set(0, 0.5, -0.7);
  tail.rotation.x = Math.PI / 2.2;
  g.add(tail);

  for (const sx of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), accentMat);
    foot.scale.set(1, 0.6, 1.2);
    foot.position.set(0.26 * sx, 0.12, 0.18);
    foot.castShadow = true;
    g.add(foot);
  }

  // 背脊（tier>=3 巨龙）
  if (tier >= 3) {
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), accentMat);
      spike.position.set(0, 1.0 - i * 0.02, 0.2 - i * 0.32);
      g.add(spike);
    }
  }

  return g;
}

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gg << 8) | bl;
}
