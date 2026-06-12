/**
 * 终局 / 双 Titan 配置（逻辑层）。从 src/config/data/endgame.json 加载。
 * 详见 specs/milestones/m4-endgame-cta.spec.md。
 */
import data from '../../config/data/endgame.json';

export interface TitanDef {
  id: string;
  name: string;
  body: number;
  accent: number;
  scale: number;
  edible: boolean;
}

const hex = (s: string): number => Number(s);

export const ENDGAME = {
  triggerLevel: data.triggerLevel,
  intro: {
    subtitleDelayMs: data.intro.subtitleDelayMs,
    othersShrinkRatio: data.intro.othersShrinkRatio,
    panDurationMs: data.intro.panDurationMs,
    title: data.intro.title,
  },
  contact: {
    range: data.contact.range,
    intervalSec: data.contact.intervalSec,
    knockback: data.contact.knockback,
  },
  titans: data.titans.map((t: any): TitanDef => ({
    id: t.id,
    name: t.name,
    body: hex(t.body),
    accent: hex(t.accent),
    scale: t.scale,
    edible: t.edible,
  })),
};
