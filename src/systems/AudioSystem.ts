import { AUDIO } from '../config/game.config';

type SfxName = 'devour' | 'levelUp' | 'evolve' | 'chest' | 'hit' | 'win' | 'lose' | 'titan';

/**
 * 合成音效系统（表现层）。用 WebAudio 振荡器即时合成，零资源、零外部请求，
 * 适配 playable 单文件 ≤5MB 约束。首次用户手势后解锁 AudioContext。
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = !AUDIO.enabled;

  /** 在首次用户手势时调用以解锁音频 */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = AUDIO.masterVolume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : AUDIO.masterVolume;
  }

  play(name: SfxName): void {
    if (this.muted || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'devour': this.blip(t, 220, 520, 0.12, 'triangle', 0.5); break;
      case 'levelUp': this.arp(t, [440, 660, 880], 0.09, 'square', 0.4); break;
      case 'evolve': this.arp(t, [330, 495, 660, 990], 0.12, 'sawtooth', 0.45); break;
      case 'chest': this.arp(t, [523, 784], 0.1, 'triangle', 0.4); break;
      case 'hit': this.blip(t, 180, 70, 0.14, 'square', 0.5); break;
      case 'titan': this.blip(t, 90, 40, 0.6, 'sawtooth', 0.6); break;
      case 'win': this.arp(t, [523, 659, 784, 1046], 0.14, 'square', 0.5); break;
      case 'lose': this.arp(t, [440, 330, 247, 165], 0.16, 'sawtooth', 0.5); break;
    }
  }

  private blip(t: number, f0: number, f1: number, dur: number, type: OscillatorType, vol: number): void {
    const o = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private arp(t: number, freqs: number[], step: number, type: OscillatorType, vol: number): void {
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t + i * step);
      g.gain.setValueAtTime(vol, t + i * step);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * step + step * 1.6);
      o.connect(g); g.connect(this.master!);
      o.start(t + i * step); o.stop(t + i * step + step * 1.8);
    });
  }
}
