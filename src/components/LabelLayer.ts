import * as THREE from 'three';
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';

interface TrackedLabel {
  obj: CSS2DObject;
  target: THREE.Object3D;
  offsetY: () => number;
}

interface FloatText {
  obj: CSS2DObject;
  age: number;
  life: number;
  el: HTMLDivElement;
}

const _wp = new THREE.Vector3();

/**
 * CSS2D 头顶标签层：等级数字（按 relation 上色）+ 浮动经验/伤害跳字。
 * 始终面向相机、任意分辨率清晰。详见 specs/components/LabelLayer.spec.md。
 */
export class LabelLayer {
  readonly renderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private tracked: TrackedLabel[] = [];
  private floats: FloatText[] = [];

  constructor(scene: THREE.Scene, container: HTMLElement, w: number, h: number) {
    this.scene = scene;
    this.renderer = new CSS2DRenderer();
    this.renderer.setSize(w, h);
    const el = this.renderer.domElement;
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '5';
    container.appendChild(el);
  }

  /** 创建一个跟随实体头顶的等级标签 */
  trackLevel(
    target: THREE.Object3D,
    text: string,
    color: number,
    offsetY: () => number,
  ): CSS2DObject {
    const div = document.createElement('div');
    div.style.cssText = `
      font:600 13px 'Segoe UI',Arial,sans-serif; color:#fff;
      text-shadow:0 1px 2px rgba(0,0,0,0.7); white-space:nowrap;
      padding:1px 6px; border-radius:8px; transform:translateY(-50%);
    `;
    div.textContent = text;
    div.style.background = this.bg(color);
    const obj = new CSS2DObject(div);
    this.scene.add(obj);
    this.tracked.push({ obj, target, offsetY });
    return obj;
  }

  setLabel(obj: CSS2DObject, text: string, color: number): void {
    const el = obj.element as HTMLDivElement;
    el.textContent = text;
    el.style.background = this.bg(color);
  }

  untrack(obj: CSS2DObject): void {
    const i = this.tracked.findIndex((t) => t.obj === obj);
    if (i >= 0) this.tracked.splice(i, 1);
    this.scene.remove(obj);
  }

  /** 在世界坐标处生成上浮+淡出的跳字 */
  floatText(worldPos: THREE.Vector3, text: string, color = 0xffffff): void {
    const el = document.createElement('div');
    el.style.cssText = `
      font:700 16px 'Segoe UI',Arial,sans-serif;
      color:#${color.toString(16).padStart(6, '0')};
      text-shadow:0 2px 4px rgba(0,0,0,0.8); white-space:nowrap;
    `;
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.copy(worldPos);
    this.scene.add(obj);
    this.floats.push({ obj, el, age: 0, life: 0.8 });
  }

  private bg(color: number): string {
    const hex = color.toString(16).padStart(6, '0');
    return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},0.55)`;
  }

  update(dt: number): void {
    for (const t of this.tracked) {
      t.target.getWorldPosition(_wp);
      t.obj.position.set(_wp.x, _wp.y + t.offsetY(), _wp.z);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.age += dt;
      const k = f.age / f.life;
      f.obj.position.y += dt * 1.6;
      f.el.style.opacity = String(Math.max(0, 1 - k));
      if (f.age >= f.life) {
        this.scene.remove(f.obj);
        this.floats.splice(i, 1);
      }
    }
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h);
  }

  dispose(): void {
    this.tracked.forEach((t) => this.scene.remove(t.obj));
    this.floats.forEach((f) => this.scene.remove(f.obj));
    this.tracked = [];
    this.floats = [];
    this.renderer.domElement.remove();
  }
}
