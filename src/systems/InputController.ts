import * as THREE from 'three';
import { INPUT_CONFIG } from '../config/game.config';

/**
 * 摇杆输入：屏幕任意位置按下即出现摇杆（DRAG TO MOVE），拖动产生 XZ 平面方向意图。
 * 相机为 +Z 上方俯视 -Z，故：屏幕右 = +X，屏幕上 = -Z。
 * 仅输出方向意图，不直接驱动渲染对象。详见 specs/systems/InputController.spec.md。
 */
export class InputController {
  /** 归一化方向（XZ 平面，y=0），长度 0..1 表示舵量 */
  readonly dir = new THREE.Vector3();
  /** 当前是否激活（按下中） */
  active = false;

  private pointerId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private dom: HTMLElement;

  // 可视化摇杆
  private baseEl: HTMLDivElement;
  private knobEl: HTMLDivElement;

  // 键盘备用
  private keys: Record<string, boolean> = {};

  constructor(dom: HTMLElement, uiRoot: HTMLElement) {
    this.dom = dom;

    const r = INPUT_CONFIG.joystickRadius;
    this.baseEl = document.createElement('div');
    this.baseEl.style.cssText = `
      position:absolute; width:${r * 2}px; height:${r * 2}px; border-radius:50%;
      background:rgba(255,255,255,0.10); border:2px solid rgba(255,255,255,0.35);
      transform:translate(-50%,-50%); pointer-events:none; display:none; z-index:20;
    `;
    this.knobEl = document.createElement('div');
    this.knobEl.style.cssText = `
      position:absolute; width:${r}px; height:${r}px; border-radius:50%;
      background:rgba(255,255,255,0.55); transform:translate(-50%,-50%);
      pointer-events:none; display:none; z-index:21;
    `;
    uiRoot.appendChild(this.baseEl);
    uiRoot.appendChild(this.knobEl);

    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.active = true;
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.baseEl.style.left = `${this.baseX}px`;
    this.baseEl.style.top = `${this.baseY}px`;
    this.baseEl.style.display = 'block';
    this.knobEl.style.left = `${this.baseX}px`;
    this.knobEl.style.top = `${this.baseY}px`;
    this.knobEl.style.display = 'block';
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const r = INPUT_CONFIG.joystickRadius;
    let dx = e.clientX - this.baseX;
    let dy = e.clientY - this.baseY;
    const len = Math.hypot(dx, dy);

    if (len < INPUT_CONFIG.deadZone) {
      this.dir.set(0, 0, 0);
      this.knobEl.style.left = `${this.baseX}px`;
      this.knobEl.style.top = `${this.baseY}px`;
      return;
    }

    const clamped = Math.min(len, r);
    const nx = dx / len;
    const ny = dy / len;
    // 屏幕右=+X，屏幕上(dy<0)=-Z
    this.dir.set(nx, 0, ny).multiplyScalar(clamped / r);

    this.knobEl.style.left = `${this.baseX + nx * clamped}px`;
    this.knobEl.style.top = `${this.baseY + ny * clamped}px`;
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.active = false;
    this.dir.set(0, 0, 0);
    this.baseEl.style.display = 'none';
    this.knobEl.style.display = 'none';
  };

  private onKey = (e: KeyboardEvent): void => {
    this.keys[e.code] = e.type === 'keydown';
  };

  /** 读取最终方向（摇杆优先，否则键盘 WASD/方向键），结果写入并返回 this.dir */
  read(): THREE.Vector3 {
    if (this.active && this.dir.lengthSq() > 0) return this.dir;

    let x = 0;
    let z = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    this.dir.set(x, 0, z);
    if (this.dir.lengthSq() > 0) this.dir.normalize();
    return this.dir;
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onDown);
    this.dom.removeEventListener('pointermove', this.onMove);
    this.dom.removeEventListener('pointerup', this.onUp);
    this.dom.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    this.baseEl.remove();
    this.knobEl.remove();
  }
}
