import * as THREE from 'three';
import { BaseScene } from '../core/BaseScene';
import type { SceneManager } from '../core/SceneManager';
import { GAME_CONSTANTS } from '../config/game.config';

export class LoadingScene extends BaseScene {
  private progressBar!: THREE.Mesh;
  private progressBg!: THREE.Mesh;

  constructor(manager: SceneManager) {
    super(manager);
  }

  async onInit(): Promise<void> {
    this.camera.position.set(0, 0, 5);

    this.scene.background = new THREE.Color(0x1a1a1a);

    const bgGeo = new THREE.PlaneGeometry(4, 0.3);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    this.progressBg = new THREE.Mesh(bgGeo, bgMat);
    this.progressBg.position.set(0, 0, 0);
    this.scene.add(this.progressBg);

    const barGeo = new THREE.PlaneGeometry(0.01, 0.25);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.progressBar = new THREE.Mesh(barGeo, barMat);
    this.progressBar.position.set(-2, 0, 0.01);
    this.scene.add(this.progressBar);
  }

  onEnter(): void {
    this.simulateLoading();
  }

  private async simulateLoading(): Promise<void> {
    // TODO: 替换为实际资源加载逻辑
    for (let i = 0; i <= 100; i += 5) {
      this.setProgress(i / 100);
      await new Promise((r) => setTimeout(r, 30));
    }
    this.manager.start(GAME_CONSTANTS.SCENES.GAME.id);
  }

  private setProgress(value: number): void {
    const width = 4 * value;
    this.progressBar.scale.x = width / 0.01;
    this.progressBar.position.x = -2 + width / 2;
  }
}
