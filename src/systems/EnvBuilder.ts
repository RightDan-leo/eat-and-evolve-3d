import * as THREE from 'three';
import { ARENA, ENV } from '../logic/config/arena';

/**
 * 环形岛环境（表现层）。圆形草地岛 + 环岛山脉 + 同心土路 + 树/石散布 + 中心灯塔。
 * 配置见 src/logic/config/arena.ts（ARENA/ENV）。
 */
export class EnvBuilder {
  private group = new THREE.Group();
  private seed = 20260612;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private rnd(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  build(): THREE.Group {
    const R = ARENA.islandRadius;

    // 圆形草地
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(R, 64),
      new THREE.MeshStandardMaterial({ color: 0x6fae46, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // 外圈一圈深色海/虚空
    const skirt = new THREE.Mesh(
      new THREE.RingGeometry(R, R + 60, 64),
      new THREE.MeshStandardMaterial({ color: 0x244a6b, roughness: 1 }),
    );
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.y = -0.5;
    this.group.add(skirt);

    // 同心土路（标识中心越近越强）
    for (const rr of [ARENA.coreRadius, ARENA.midRadius]) {
      const path = new THREE.Mesh(
        new THREE.RingGeometry(rr - 1.2, rr + 1.2, 64),
        new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 1, transparent: true, opacity: 0.6 }),
      );
      path.rotation.x = -Math.PI / 2;
      path.position.y = 0.03;
      this.group.add(path);
    }

    // 环岛山脉
    const mountMat = new THREE.MeshStandardMaterial({ color: 0x6b6f78, roughness: 1, flatShading: true });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 1, flatShading: true });
    for (let i = 0; i < ENV.mountains; i++) {
      const ang = (i / ENV.mountains) * Math.PI * 2;
      const h = 14 + this.rnd() * 16;
      const m = new THREE.Mesh(new THREE.ConeGeometry(7 + this.rnd() * 5, h, 5), mountMat);
      m.position.set(Math.cos(ang) * (R + 6), h / 2 - 1, Math.sin(ang) * (R + 6));
      m.rotation.y = this.rnd() * Math.PI;
      m.castShadow = true;
      this.group.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, h * 0.32, 5), snowMat);
      cap.position.set(m.position.x, h - h * 0.16 - 1, m.position.z);
      this.group.add(cap);
    }

    // 树
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f3e, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8f98, flatShading: true });
    for (let i = 0; i < ENV.trees; i++) {
      const { x, z } = this.randInIsland(R * 0.95, 8);
      const tree = new THREE.Group();
      const h = 1.6 + this.rnd() * 1.8;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, h, 6), trunkMat);
      trunk.position.y = h / 2; trunk.castShadow = true;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9 + this.rnd() * 0.5, 1.8, 7), leafMat);
      leaf.position.y = h + 0.7; leaf.castShadow = true;
      tree.add(trunk, leaf); tree.position.set(x, 0, z);
      this.group.add(tree);
    }
    for (let i = 0; i < ENV.rocks; i++) {
      const { x, z } = this.randInIsland(R * 0.95, 8);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + this.rnd() * 0.7, 0), rockMat);
      rock.position.set(x, 0.3, z); rock.rotation.set(this.rnd(), this.rnd(), this.rnd());
      rock.castShadow = true; this.group.add(rock);
    }

    // 中心灯塔（最强区视觉锚点）
    if (ENV.beacon) {
      const beaconMat = new THREE.MeshStandardMaterial({ color: 0x7a3aff, emissive: 0x4a1f8a, emissiveIntensity: 0.8, flatShading: true });
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 6, 6), beaconMat);
      beacon.position.set(0, 3, 0);
      this.group.add(beacon);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), new THREE.MeshBasicMaterial({ color: 0xc18bff }));
      orb.position.set(0, 6.6, 0);
      this.group.add(orb);
    }

    this.scene.add(this.group);
    return this.group;
  }

  private randInIsland(maxR: number, minR: number): { x: number; z: number } {
    const ang = this.rnd() * Math.PI * 2;
    const r = minR + this.rnd() * (maxR - minR);
    return { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.scene.remove(this.group);
  }
}
