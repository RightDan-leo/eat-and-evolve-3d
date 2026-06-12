import * as THREE from 'three';
import {
  CAMERA_BY_LEVEL,
  CAMERA_RIG_CONFIG,
  sampleByLevel,
} from '../config/game.config';

/**
 * 3/4 俯视相机绑定。相机位于目标点的 +Z 上方，俯视目标；
 * 距离/高度随玩家等级（体型）在曲线上连续插值，玩家越大相机越远，
 * 营造"世界越来越小"的核心视觉爽点。详见 specs/systems/CameraRig.spec.md。
 */
export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();

  private curDistance: number;
  private curHeight: number;

  constructor(camera: THREE.PerspectiveCamera, startLevel = 1) {
    this.camera = camera;
    this.curDistance = sampleByLevel(CAMERA_BY_LEVEL, startLevel, 'distance');
    this.curHeight = sampleByLevel(CAMERA_BY_LEVEL, startLevel, 'height');
    this.snapTo(this.target);
  }

  /** 立即把相机摆到目标位（无插值），用于初始化 */
  snapTo(target: THREE.Vector3): void {
    this.target.copy(target);
    this.camera.position.set(
      target.x,
      target.y + this.curHeight,
      target.z + this.curDistance,
    );
    this.camera.lookAt(this.target);
  }

  /**
   * 每帧调用。
   * @param targetPos 玩家世界坐标
   * @param level     玩家当前等级（驱动距离/高度曲线）
   * @param dt        帧间隔（秒）
   */
  update(targetPos: THREE.Vector3, level: number, dt: number): void {
    // 平滑目标点跟随
    const followK = 1 - Math.exp(-CAMERA_RIG_CONFIG.followLerp * dt);
    this.target.lerp(targetPos, followK);

    // 距离/高度向目标曲线值柔和插值（拉远手感）
    const wantDist = sampleByLevel(CAMERA_BY_LEVEL, level, 'distance');
    const wantHeight = sampleByLevel(CAMERA_BY_LEVEL, level, 'height');
    const zoomK = 1 - Math.exp(-CAMERA_RIG_CONFIG.zoomLerp * dt);
    this.curDistance += (wantDist - this.curDistance) * zoomK;
    this.curHeight += (wantHeight - this.curHeight) * zoomK;

    this.camera.position.set(
      this.target.x,
      this.target.y + this.curHeight,
      this.target.z + this.curDistance,
    );
    this.camera.lookAt(this.target);
  }

  /** 当前俯角（度），用于调试显示 */
  get pitchDeg(): number {
    return (Math.atan2(this.curHeight, this.curDistance) * 180) / Math.PI;
  }
}
