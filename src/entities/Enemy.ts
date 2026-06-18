import { rand } from '../math';
import type { Box } from '../types';

export type EnemyType = 'normal' | 'fast' | 'boss';

/** Stats table indexed by enemy type */
const STATS: Record<EnemyType, { w: number; hp: number; speed: number; damage: number }> = {
  normal: { w: 32, hp: 3,  speed: 1.15, damage: 1 },
  fast:   { w: 26, hp: 2,  speed: 1.9,  damage: 1 },
  boss:   { w: 46, hp: 10, speed: 0.9,  damage: 2 },
};

export class Enemy {
  x: number;
  y: number;
  type: EnemyType;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  knx = 0;
  kny = 0;
  hitTimer = 0;
  atkTimer = 0;

  constructor(x: number, y: number, type: EnemyType) {
    this.x = x;
    this.y = y;
    this.type = type;
    const s = STATS[type];
    this.w = s.w;
    this.h = s.w;
    this.hp = s.hp;
    this.maxHp = s.hp;
    this.speed = s.speed;
    this.damage = s.damage;
  }

  get box(): Box {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  get alive(): boolean {
    return this.hp > 0;
  }
}

/** Pick a random enemy type, weighted */
export function randomEnemyType(bossRoom: boolean): EnemyType {
  if (bossRoom) return 'boss';
  return Math.random() < 0.3 ? 'fast' : 'normal';
}
