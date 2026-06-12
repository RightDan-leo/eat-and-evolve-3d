import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { BaseScene } from '../core/BaseScene';
import type { SceneManager } from '../core/SceneManager';
import { CameraRig } from '../systems/CameraRig';
import { InputController } from '../systems/InputController';
import { Dragon } from '../entities/Dragon';
import { Enemy } from '../entities/Enemy';
import { LabelLayer } from '../components/LabelLayer';
import { EvolutionChoicePanel } from '../components/EvolutionChoicePanel';
import { FxSystem } from '../systems/FxSystem';
import { Titan } from '../entities/Titan';
import { EnvBuilder } from '../systems/EnvBuilder';
import { ChestField } from '../systems/ChestField';
import { AudioSystem } from '../systems/AudioSystem';
import { HudOverlay } from '../components/HudOverlay';
import { CombatSystem } from '../logic/systems/CombatSystem';
import { EvolutionSystem } from '../logic/systems/EvolutionSystem';
import { FORMS } from '../logic/config/evolution';
import { ARENA, SPAWN } from '../logic/config/arena';
import { ENDGAME } from '../logic/config/endgame';
import { getVariant, parseVariantId, type VariantSpec } from '../logic/config/variants';
import { makeSpawnRequest, starterPreyRequests } from '../logic/systems/SpawnSystem';
import { GAME_CONSTANTS, INPUT_CONFIG, sampleByLevel } from '../config/game.config';
import { expReward, expToNext, MAX_LEVEL } from '../logic/config/progression';

const ISLAND_R = ARENA.islandRadius;
const ENEMY_TARGET = SPAWN.maxAlive;

/**
 * M1 核心吞噬：自由移动 → 吃 ≤自身等级的怪秒杀吞噬 → 经验/等级↑ → 体型变大 → 相机拉远。
 * 详见 specs/milestones/m1-core-devour.spec.md。
 * 注：临时刷怪逻辑在本场景内（M3 由 SpawnSystem 接管）。
 */
export class GameScene extends BaseScene {
  private rig!: CameraRig;
  private input!: InputController;
  private combat = new CombatSystem();
  private evolution = new EvolutionSystem();
  private labels!: LabelLayer;
  private fx!: FxSystem;
  private env!: EnvBuilder;
  private chests!: ChestField;
  private evoPanel!: EvolutionChoicePanel;
  private hud!: HudOverlay;
  private audio = new AudioSystem();
  private cinematic = false;
  private _fxTarget = new THREE.Vector3();
  private chestBar!: HTMLDivElement;
  private chestBarFill!: HTMLDivElement;

  // 终局（双 Titan）
  private variant: VariantSpec = getVariant(parseVariantId(new URLSearchParams(location.search).get('v')));
  private endPhase: 'play' | 'intro' | 'fight' | 'ended' = 'play';
  private titans: Titan[] = [];
  private titanLabels = new Map<Titan, CSS2DObject>();
  private introT = 0;
  private titanContactCd = 0;
  private bannerEl: HTMLDivElement | null = null;
  private _titanMid = new THREE.Vector3();

  private player!: Dragon;
  private playerLabel!: CSS2DObject;
  private enemies: Enemy[] = [];
  private enemyLabels = new Map<Enemy, CSS2DObject>();

  private uiRoot!: HTMLElement;
  private infoEl!: HTMLDivElement;
  private hpFill!: HTMLDivElement;
  private expFill!: HTMLDivElement;
  private deathEl: HTMLDivElement | null = null;

  private fpsAccum = 0;
  private fpsFrames = 0;
  private fps = 0;
  private rngSeed = 9973;

  constructor(manager: SceneManager) {
    super(manager);
  }

  async onInit(): Promise<void> {
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 220);
    this.camera.fov = 45;
    this.camera.far = 600;
    this.camera.updateProjectionMatrix();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(40, 80, 30);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const sc = dir.shadow.camera as THREE.OrthographicCamera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 1; sc.far = 300;
    this.scene.add(dir);

    this.env = new EnvBuilder(this.scene);
    this.env.build();

    // 玩家（从岛屿边缘起步，向中心进化）
    this.player = await Dragon.create(GAME_CONSTANTS.ASSETS.MODELS + 'hatchling.glb');
    this.player.object.position.set(0, 0, ISLAND_R * 0.78);
    this.scene.add(this.player.object);

    // 相机 / 输入 / 标签层
    this.rig = new CameraRig(this.camera, this.player.level);
    this.rig.snapTo(this.player.object.position);
    this.uiRoot = document.getElementById('ui-overlay')!;
    this.input = new InputController(this.manager.renderer.domElement, this.uiRoot);
    const container = document.getElementById('game-container')!;
    this.labels = new LabelLayer(this.scene, container, this.manager.width, this.manager.height);
    this.fx = new FxSystem(this.scene);
    this.fx.onAbsorb = () => this.player.absorbPulse();
    this.evoPanel = new EvolutionChoicePanel(this.uiRoot);

    this.chests = new ChestField(this.scene);
    this.chests.build();
    this.chests.onOpen = (exp) => this.onChestOpen(exp);

    this.hud = new HudOverlay(this.uiRoot);
    this.hud.onReplay = () => this.restart();

    // 首次手势解锁音频
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });

    this.playerLabel = this.labels.trackLevel(
      this.player.object,
      `Lv.${this.player.level}`,
      0xffffff,
      () => this.player.labelOffsetY,
    );

    this.populateInitial();
    this.refreshRelations();
    this.buildHUD();
  }

  /** 开局：身边布置弱猎物，其余按分区难度铺满 */
  private populateInitial(): void {
    const pp = this.player.object.position;
    for (const req of starterPreyRequests(this.player.level, pp.x, pp.z, () => this.rand())) {
      this.addEnemyFromRequest(req);
    }
    while (this.enemies.length < ENEMY_TARGET) this.spawnEnemy();
  }

  // ─── 刷怪（临时；M3 由 SpawnSystem 接管） ──────────────
  private rand(): number {
    this.rngSeed = (this.rngSeed * 1103515245 + 12345) & 0x7fffffff;
    return this.rngSeed / 0x7fffffff;
  }

  private spawnEnemy(near = false): void {
    const pp = this.player.object.position;
    const req = makeSpawnRequest(this.player.level, pp.x, pp.z, near, () => this.rand());
    this.addEnemyFromRequest(req);
  }

  private addEnemyFromRequest(req: { level: number; kind: any; x: number; z: number; prey: boolean }): void {
    const enemy = new Enemy(req.level, { prey: req.prey, kind: req.kind });
    enemy.object.position.set(req.x, 0, req.z);
    enemy.applySizing(this.player.scale, this.player.level);
    this.scene.add(enemy.object);
    this.enemies.push(enemy);

    const label = this.labels.trackLevel(
      enemy.object,
      `Lv.${enemy.level}`,
      this.combat.colorOf(this.player.level, enemy.level),
      () => enemy.labelOffsetY,
    );
    this.enemyLabels.set(enemy, label);
  }

  private removeEnemy(enemy: Enemy): void {
    const label = this.enemyLabels.get(enemy);
    if (label) this.labels.untrack(label);
    this.enemyLabels.delete(enemy);
    this.scene.remove(enemy.object);
    enemy.dispose();
    this.combat.forget(enemy.id);
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  /** 回收离玩家过远的非追逐怪，并在中心方向补刷，维持密度与分区难度 */
  private recycleFarEnemies(): void {
    const pp = this.player.object.position;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.kindCfg.chaser) continue;
      const dx = e.object.position.x - pp.x;
      const dz = e.object.position.z - pp.z;
      if (Math.hypot(dx, dz) > SPAWN.recycleRadius) this.removeEnemy(e);
    }
    while (this.enemies.length < ENEMY_TARGET) this.spawnEnemy(this.rand() < 0.4);
  }

  private clearTitans(): void {
    for (const t of this.titans) {
      const label = this.titanLabels.get(t);
      if (label) this.labels.untrack(label);
      this.scene.remove(t.object);
      t.dispose();
    }
    this.titans = [];
    this.titanLabels.clear();
  }

  private onChestOpen(exp: number): void {
    const pos = this.chests.channelPos ?? this.player.object.position.clone();
    this.fx.evolutionRing(pos, 1.2);
    this.audio.play('chest');
    this.labels.floatText(new THREE.Vector3(pos.x, 1.8, pos.z), `宝箱 +${exp} EXP`, 0xffe14d);
    const gained = this.player.addExp(exp);
    if (gained > 0) {
      this.labels.setLabel(this.playerLabel, `Lv.${this.player.level}`, 0xffe14d);
      this.refreshRelations();
      this.checkEvolution();
    }
  }

  // ─── 终局：双 Titan 登场 → 反转 → 结算 ───────────────
  private maybeStartEndgame(): void {
    if (this.player.level >= ENDGAME.triggerLevel) this.startTitanIntro();
  }

  private startTitanIntro(): void {
    this.endPhase = 'intro';
    this.cinematic = true;
    this.introT = 0;

    // 其他怪缩小，营造泰坦压迫感
    for (const e of this.enemies) e.object.scale.multiplyScalar(ENDGAME.intro.othersShrinkRatio);

    // 在玩家前方中心方向生成两只泰坦
    const pp = this.player.object.position;
    const toCenter = new THREE.Vector3(-pp.x, 0, -pp.z);
    if (toCenter.lengthSq() < 0.01) toCenter.set(0, 0, -1);
    toCenter.normalize();
    const base = pp.clone().addScaledVector(toCenter, 22);
    const side = new THREE.Vector3(-toCenter.z, 0, toCenter.x);

    ENDGAME.titans.forEach((def, i) => {
      const offset = (i === 0 ? -1 : 1) * 7;
      const useVariantBoss = def.id === 'purple';
      const titan = new Titan(def, {
        maxHp: useVariantBoss ? this.variant.boss.maxHp : 9999,
        contactDamage: useVariantBoss ? this.variant.boss.contactPlayerDamage : ENDGAME.contact.knockback,
        immune: useVariantBoss ? this.variant.boss.immune : true,
      });
      const tp = base.clone().addScaledVector(side, offset);
      titan.object.position.set(
        THREE.MathUtils.clamp(tp.x, -ISLAND_R + 8, ISLAND_R - 8),
        0,
        THREE.MathUtils.clamp(tp.z, -ISLAND_R + 8, ISLAND_R - 8),
      );
      this.scene.add(titan.object);
      this.titans.push(titan);
      const label = this.labels.trackLevel(titan.object, def.name, def.body, () => titan.labelOffsetY);
      this.titanLabels.set(titan, label);
    });

    this.audio.play('titan');
    this.showBanner(ENDGAME.intro.title, '', 0);
    window.setTimeout(() => {
      const tip = this.variant.outcome === 'win' ? '冲上去吞噬虚空泰坦！' : '它太强了……快逃！';
      this.showBanner(ENDGAME.intro.title, tip, 2600);
    }, ENDGAME.intro.subtitleDelayMs);
  }

  private updateIntro(dt: number): void {
    this.introT += dt;
    // 相机在玩家与泰坦中点之间推近，并拉到更广视角
    this._titanMid.set(0, 0, 0);
    for (const t of this.titans) this._titanMid.add(t.object.position);
    this._titanMid.multiplyScalar(1 / Math.max(1, this.titans.length));
    const k = Math.min(1, this.introT / (ENDGAME.intro.panDurationMs / 1000));
    const target = this.player.object.position.clone().lerp(this._titanMid, k * 0.6);
    this.rig.update(target, MAX_LEVEL, dt);

    if (this.introT >= ENDGAME.intro.panDurationMs / 1000 + 1.2) {
      this.endPhase = 'fight';
      this.cinematic = false;
      this.showBanner(
        this.variant.outcome === 'win' ? '反击吧！' : '生存挑战',
        this.variant.outcome === 'win' ? '撞击虚空泰坦将其吞噬' : '躲避泰坦的践踏',
        2200,
      );
    }
  }

  private resolveTitans(dt: number): void {
    this.titanContactCd = Math.max(0, this.titanContactCd - dt);
    const pp = this.player.object.position;
    for (let i = this.titans.length - 1; i >= 0; i--) {
      const t = this.titans[i];
      if (!t.alive) continue;
      const dx = pp.x - t.object.position.x;
      const dz = pp.z - t.object.position.z;
      const reach = this.player.radius * this.evolution.reachMul + t.radius;
      if (dx * dx + dz * dz > reach * reach) continue;

      // 玩家撞击：对可吞噬（紫）泰坦造成伤害
      if (t.def.edible && !t.immune) {
        const died = t.takeDamage(this.variant.boss.contactBossDamage);
        this.fx.devourBurst(t.object.position.clone());
        this.labels.floatText(
          new THREE.Vector3(t.object.position.x, t.labelOffsetY * 0.6, t.object.position.z),
          `-${this.variant.boss.contactBossDamage}`, 0xffe14d,
        );
        if (died) { this.onTitanDevoured(t); return; }
      }

      // 泰坦反击玩家
      if (this.titanContactCd <= 0) {
        this.titanContactCd = ENDGAME.contact.intervalSec;
        const died = this.player.takeDamage(t.contactDamage);
        this.labels.floatText(
          new THREE.Vector3(pp.x, this.player.labelOffsetY * 0.7, pp.z),
          `-${t.contactDamage}`, 0xff5555,
        );
        // 击退
        const d = Math.hypot(dx, dz) || 1;
        pp.x += (dx / d) * ENDGAME.contact.knockback;
        pp.z += (dz / d) * ENDGAME.contact.knockback;
        if (died) { this.endGame('lose'); return; }
      }
    }
  }

  private onTitanDevoured(t: Titan): void {
    const label = this.titanLabels.get(t);
    if (label) this.labels.untrack(label);
    this.titanLabels.delete(t);
    this.fx.evolutionRing(t.object.position, t.radius);
    this.scene.remove(t.object);
    t.dispose();
    this.titans = this.titans.filter((x) => x !== t);
    this.player.addExp(80);
    this.endGame('win');
  }

  private endGame(outcome: 'win' | 'lose'): void {
    if (this.endPhase === 'ended') return;
    this.endPhase = 'ended';
    this.clearBanner();
    this.audio.play(outcome === 'win' ? 'win' : 'lose');
    this.hud.show({
      outcome,
      title: this.variant.end.title,
      subtitle: this.variant.end.subtitle,
      buttonLabel: this.variant.end.buttonLabel,
      level: this.player.level,
    });
  }

  private showBanner(title: string, subtitle: string, autoHideMs: number): void {
    this.clearBanner();
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute; left:50%; top:16%; transform:translateX(-50%); z-index:36; text-align:center;
      font-family:'Segoe UI',Arial,sans-serif; pointer-events:none;
    `;
    el.innerHTML = `
      <div style="font-size:30px;font-weight:900;color:#ffe14d;text-shadow:0 3px 10px rgba(0,0,0,0.7);">${title}</div>
      ${subtitle ? `<div style="font-size:16px;color:#fff;margin-top:6px;text-shadow:0 2px 6px rgba(0,0,0,0.7);">${subtitle}</div>` : ''}
    `;
    this.uiRoot.appendChild(el);
    this.bannerEl = el;
    if (autoHideMs > 0) window.setTimeout(() => { if (this.bannerEl === el) this.clearBanner(); }, autoHideMs);
  }

  private clearBanner(): void {
    this.bannerEl?.remove();
    this.bannerEl = null;
  }

  /** 玩家等级变化后刷新所有敌人的体型与 relation 颜色 */
  private refreshRelations(): void {
    for (const e of this.enemies) {
      e.applySizing(this.player.scale, this.player.level);
      e.setRelationColor(this.combat.colorOf(this.player.level, e.level));
      const label = this.enemyLabels.get(e);
      if (label) this.labels.setLabel(label, `Lv.${e.level}`, this.combat.colorOf(this.player.level, e.level));
    }
  }

  onUpdate(delta: number): void {
    const dt = Math.min(delta, 0.05);
    this.combat.update(dt);

    const canControl = this.player.alive && !this.cinematic
      && this.endPhase !== 'intro' && this.endPhase !== 'ended';

    if (canControl) {
      const dir = this.input.read();
      if (dir.lengthSq() > 0) {
        const speed = sampleByLevel(INPUT_CONFIG.moveSpeedByLevel, this.player.level, 'speed') * this.evolution.speedMul;
        const p = this.player.object.position;
        p.x += dir.x * speed * dt;
        p.z += dir.z * speed * dt;
        const d = Math.hypot(p.x, p.z);
        if (d > ISLAND_R - 2) { const s = (ISLAND_R - 2) / d; p.x *= s; p.z *= s; }
        this.player.faceDir(dir.x, dir.z, dt);
      }
      if (this.endPhase === 'play') this.resolveCombat();
      else if (this.endPhase === 'fight') this.resolveTitans(dt);
    }

    if (this.endPhase === 'play') this.maybeStartEndgame();

    this.player.update(dt);
    const pp = this.player.object.position;
    for (const e of this.enemies) e.update(dt, pp, ISLAND_R);
    for (const t of this.titans) t.update(dt);
    if (this.endPhase === 'play') {
      this.recycleFarEnemies();
      this.chests.update(dt, pp, this.player.radius);
    }

    if (this.endPhase === 'intro') {
      this.updateIntro(dt);
    } else {
      this.rig.update(pp, this.player.level, dt);
    }

    this._fxTarget.set(pp.x, this.player.labelOffsetY * 0.55, pp.z);
    this.fx.update(dt, this._fxTarget);
    this.labels.update(dt);

    this.fpsAccum += delta;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
    this.updateHUD();
  }

  private resolveCombat(): void {
    const pp = this.player.object.position;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const dx = pp.x - e.object.position.x;
      const dz = pp.z - e.object.position.z;
      const reach = this.player.radius * this.evolution.reachMul + e.radius;
      if (dx * dx + dz * dz > reach * reach) continue;

      const out = this.combat.resolveContact(this.player.level, {
        id: e.id, level: e.level, hp: e.hp, maxHp: e.maxHp,
        contactDamage: e.contactDamage, prey: e.prey,
      });
      if (!out) continue;

      e.takeDamage(out.dmgToEnemy);
      if (out.dmgToPlayer > 0) {
        this.audio.play('hit');
        const died = this.player.takeDamage(out.dmgToPlayer);
        this.labels.floatText(
          new THREE.Vector3(pp.x, this.player.labelOffsetY * 0.7, pp.z),
          `-${out.dmgToPlayer}`,
          0xff5555,
        );
        if (died) { this.onPlayerDeath(); return; }
      }

      if (!e.alive) this.devour(e);
    }
  }

  private devour(enemy: Enemy): void {
    const gain = expReward(this.player.level, enemy.level);
    const epos = enemy.object.position.clone();
    this.fx.devourBurst(epos);
    this.audio.play('devour');
    this.labels.floatText(
      new THREE.Vector3(epos.x, enemy.labelOffsetY, epos.z),
      `+${gain} EXP`,
      0x9bff7a,
    );
    this.removeEnemy(enemy);
    const gained = this.player.addExp(gain);
    if (gained > 0) {
      this.labels.setLabel(this.playerLabel, `Lv.${this.player.level}`, 0xffe14d);
      this.labels.floatText(
        new THREE.Vector3(this.player.object.position.x, this.player.labelOffsetY + 0.6, this.player.object.position.z),
        `LEVEL UP! Lv.${this.player.level}`,
        0xffe14d,
      );
      this.refreshRelations();
      this.checkEvolution();
    }
    if (this.enemies.length < ENEMY_TARGET) this.spawnEnemy(this.rand() < 0.5);
  }

  /** 升级后推进形态进化（morph + 金环 + 可能的分支选择） */
  private checkEvolution(): void {
    const ev = this.evolution.step(this.player.level);
    if (ev.formUp === undefined) { this.audio.play('levelUp'); return; }
    const form = FORMS[ev.formUp];
    this.player.applyForm(form.body, form.accent, form.tier);
    this.fx.evolutionRing(this.player.object.position, this.player.radius);
    this.audio.play('evolve');

    if (ev.branchOffer) {
      this.cinematic = true;
      this.evoPanel.open(ev.branchOffer).then((id) => {
        const opt = this.evolution.applyBranch(id);
        if (opt) {
          this.player.applyForm(opt.body, opt.accent, form.tier);
          this.fx.evolutionRing(this.player.object.position, this.player.radius);
          this.labels.floatText(
            new THREE.Vector3(this.player.object.position.x, this.player.labelOffsetY + 0.6, this.player.object.position.z),
            `${opt.name}！`,
            opt.body,
          );
        }
        this.cinematic = false;
      });
    }
  }

  private onPlayerDeath(): void {
    if (this.deathEl) return;
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute; inset:0; display:flex; flex-direction:column;
      justify-content:center; align-items:center; gap:16px;
      background:rgba(10,12,20,0.72); z-index:40; font-family:'Segoe UI',Arial,sans-serif;
    `;
    el.innerHTML = `
      <div style="font-size:42px;color:#ff6b6b;font-weight:800;">被反杀了！</div>
      <div style="font-size:16px;color:#cdd;">Lv.${this.player.level} · 红色高等级怪太危险</div>
    `;
    const btn = document.createElement('button');
    btn.textContent = '↻ 重玩一次';
    btn.style.cssText = `
      margin-top:8px; padding:12px 28px; border:none; border-radius:10px;
      background:#3b82f6; color:#fff; font-size:18px; font-weight:700; cursor:pointer;
    `;
    btn.addEventListener('click', () => this.restart());
    el.appendChild(btn);
    this.uiRoot.appendChild(el);
    this.deathEl = el;
  }

  private restart(): void {
    this.deathEl?.remove();
    this.deathEl = null;
    this.hud.close();
    this.clearBanner();
    for (const e of [...this.enemies]) this.removeEnemy(e);
    this.clearTitans();
    this.endPhase = 'play';
    this.introT = 0;
    this.combat.reset();
    this.evolution.reset();
    this.player.reset();
    this.player.object.position.set(0, 0, ISLAND_R * 0.78);
    this.player.applyForm(FORMS[0].body, FORMS[0].accent, FORMS[0].tier);
    this.cinematic = false;
    this.evoPanel.close();
    this.chests.reset();
    this.labels.setLabel(this.playerLabel, `Lv.${this.player.level}`, 0xffffff);
    this.populateInitial();
    this.refreshRelations();
    this.rig.snapTo(this.player.object.position);
  }

  onResize(width: number, height: number): void {
    super.onResize(width, height);
    this.labels?.resize(width, height);
  }

  onRender(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
    this.labels?.render(this.camera);
  }

  onExit(): void {
    this.input?.dispose();
    this.labels?.dispose();
    this.fx?.dispose();
    this.evoPanel?.close();
    this.hud?.close();
    this.clearBanner();
    this.clearTitans();
    this.chests?.dispose();
    this.env?.dispose();
  }

  // ─── HUD ───────────────────────────────
  private buildHUD(): void {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:absolute; top:10px; left:10px; z-index:30; min-width:200px;
      font-family:'Segoe UI',Arial,sans-serif; color:#fff;
      background:rgba(0,0,0,0.45); padding:10px 12px; border-radius:10px; font-size:13px;
    `;
    this.infoEl = document.createElement('div');
    this.infoEl.style.lineHeight = '1.6';
    panel.appendChild(this.infoEl);

    const mkBar = (label: string, color: string): HTMLDivElement => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-top:6px;';
      const cap = document.createElement('div');
      cap.textContent = label;
      cap.style.cssText = 'font-size:11px;color:#cde;margin-bottom:2px;';
      const track = document.createElement('div');
      track.style.cssText = 'height:10px;background:rgba(255,255,255,0.15);border-radius:5px;overflow:hidden;';
      const fill = document.createElement('div');
      fill.style.cssText = `height:100%;width:100%;background:${color};transition:width .12s;`;
      track.appendChild(fill); wrap.appendChild(cap); wrap.appendChild(track);
      panel.appendChild(wrap);
      return fill;
    };
    this.hpFill = mkBar('生命 HP', 'linear-gradient(90deg,#ff5b5b,#ff8e6b)');
    this.expFill = mkBar('经验 EXP', 'linear-gradient(90deg,#4dd0ff,#7affb0)');

    const tip = document.createElement('div');
    tip.style.cssText = 'margin-top:8px;font-size:11px;color:#9bb;';
    tip.textContent = '任意位置拖动=移动 · 吃绿色怪升级 · 躲红色怪';
    panel.appendChild(tip);

    this.uiRoot.appendChild(panel);

    // 静音切换
    const mute = document.createElement('button');
    mute.textContent = '🔊';
    mute.style.cssText = `
      position:absolute; top:10px; right:10px; z-index:31; width:38px; height:38px;
      border:none; border-radius:50%; background:rgba(0,0,0,0.45); color:#fff;
      font-size:18px; cursor:pointer; pointer-events:auto;
    `;
    mute.addEventListener('click', () => {
      this.audio.unlock();
      const m = !this.audio.muted;
      this.audio.setMuted(m);
      mute.textContent = m ? '🔇' : '🔊';
    });
    this.uiRoot.appendChild(mute);

    // 开箱读条
    this.chestBar = document.createElement('div');
    this.chestBar.style.cssText = `
      position:absolute; left:50%; bottom:18%; transform:translateX(-50%); z-index:31;
      width:180px; height:14px; background:rgba(0,0,0,0.5); border-radius:7px; overflow:hidden;
      display:none; border:1px solid rgba(255,225,77,0.5);
    `;
    this.chestBarFill = document.createElement('div');
    this.chestBarFill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#ffd83b,#ff9b3b);';
    this.chestBar.appendChild(this.chestBarFill);
    const chestCap = document.createElement('div');
    chestCap.textContent = '开启宝箱中…';
    chestCap.style.cssText = 'position:absolute;left:50%;bottom:calc(18% + 18px);transform:translateX(-50%);color:#ffe14d;font-size:12px;font-family:Arial;z-index:31;display:none;';
    this.uiRoot.appendChild(this.chestBar);
    (this.chestBar as any)._cap = chestCap;
    this.uiRoot.appendChild(chestCap);

    this.updateHUD();
  }

  private updateHUD(): void {
    if (!this.infoEl) return;
    this.infoEl.innerHTML = `
      <div style="font-weight:600;color:#9bd0ff;">吞噬进化岛</div>
      <div>等级 Lv: <b>${this.player.level}</b> / ${MAX_LEVEL}</div>
      <div>体型: <b>${this.player.scale.toFixed(2)}</b> · 怪: <b>${this.enemies.length}</b> · FPS: <b>${this.fps}</b></div>
    `;
    this.hpFill.style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;
    const need = expToNext(this.player.level);
    this.expFill.style.width = `${Math.min(100, (this.player.exp / need) * 100)}%`;

    const channeling = this.chests?.isChanneling ?? false;
    const cap = (this.chestBar as any)?._cap as HTMLDivElement | undefined;
    if (this.chestBar) {
      this.chestBar.style.display = channeling ? 'block' : 'none';
      if (cap) cap.style.display = channeling ? 'block' : 'none';
      if (channeling) this.chestBarFill.style.width = `${this.chests.channelProgress * 100}%`;
    }
  }
}
