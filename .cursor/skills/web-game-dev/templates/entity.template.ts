/**
 * 实体模板
 * 复制此文件并重命名为你的实体名称
 */
import Phaser from 'phaser';

export interface EntityConfig {
  speed?: number;
  health?: number;
}

const DEFAULT_CONFIG: Required<EntityConfig> = {
  speed: 200,
  health: 100,
};

export class TemplateEntity extends Phaser.Physics.Arcade.Sprite {
  private config: Required<EntityConfig>;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    config?: EntityConfig
  ) {
    super(scene, x, y, texture);

    this.config = { ...DEFAULT_CONFIG, ...config };

    // 添加到场景
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 设置物理属性
    this.setCollideWorldBounds(true);

    // 初始化
    this.init();
  }

  private init(): void {
    // 初始化逻辑
  }

  /**
   * 每帧更新
   * 需要在场景的 update 中调用
   */
  update(delta: number): void {
    // 更新逻辑
  }

  /**
   * 移动
   */
  move(direction: { x: number; y: number }): void {
    this.setVelocity(
      direction.x * this.config.speed,
      direction.y * this.config.speed
    );
  }

  /**
   * 受伤
   */
  takeDamage(amount: number): void {
    this.config.health -= amount;
    if (this.config.health <= 0) {
      this.die();
    }
  }

  /**
   * 死亡
   */
  private die(): void {
    this.destroy();
  }
}
