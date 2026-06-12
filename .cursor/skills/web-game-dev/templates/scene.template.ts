/**
 * 场景模板
 * 复制此文件并重命名为你的场景名称
 */
import Phaser from 'phaser';

export class TemplateScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TemplateScene' }); // 修改场景键名
  }

  /**
   * 场景初始化
   * 接收从其他场景传递的数据
   */
  init(data: unknown): void {
    // 处理传入数据
  }

  /**
   * 预加载资源
   * 仅在此场景需要额外资源时使用
   */
  preload(): void {
    // this.load.image('key', 'path');
  }

  /**
   * 创建场景内容
   * 初始化游戏对象、设置物理、绑定事件
   */
  create(): void {
    // 创建游戏对象
    // 设置物理碰撞
    // 绑定输入事件
  }

  /**
   * 每帧更新
   * @param time - 游戏启动后的总时间（毫秒）
   * @param delta - 距上一帧的时间差（毫秒）
   */
  update(time: number, delta: number): void {
    // 更新逻辑
  }
}
