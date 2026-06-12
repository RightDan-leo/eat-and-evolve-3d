import * as THREE from 'three';
import type { SceneManager } from './SceneManager';

export abstract class BaseScene {
  readonly scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected manager: SceneManager;

  constructor(manager: SceneManager) {
    this.manager = manager;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, manager.aspect, 0.1, 1000);
  }

  async onInit(): Promise<void> {}
  onEnter(): void {}
  onExit(): void {}
  onUpdate(_delta: number): void {}
  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  onRender(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }
  onDestroy(): void {}
}
