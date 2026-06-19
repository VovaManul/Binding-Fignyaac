import { describe, it, expect } from 'bun:test';
import { OX, OY, TILE, COLS, ROWS } from '../src/config';
import { Room } from '../src/core/world/Room';
import { Projectile } from '../src/core/entities/Projectile';
import { Enemy } from '../src/core/entities/Enemy';
import {
  applyWeaponProjectileStats,
  explodeBomb,
  projectileHitWall,
} from '../src/core/systems/projectiles';
import { WEAPONS } from '../src/core/weapons';
import { NEUTRAL_STATS } from '../src/core/entities/Player';

const S = NEUTRAL_STATS;

function makeRoom() {
  const r = new Room(0, 0, 'normal');
  r.cleared = true;
  r.rebuildTiles();
  return r;
}

describe('applyWeaponProjectileStats', () => {
  it('копирует урон и параметры горения из оружия', () => {
    const t = new Projectile(0, 0, 1, 0, 'fireball');
    applyWeaponProjectileStats(t, WEAPONS.staff, S);
    expect(t.damage).toBe(WEAPONS.staff.damage);
    expect(t.burnDamage).toBe(WEAPONS.staff.fireDmg);
    expect(t.burnInterval).toBe(WEAPONS.staff.fireInterval);
    expect(t.burnDuration).toBe(WEAPONS.staff.fireDuration);
  });

  it('для бомбы выставляет explosionRadius', () => {
    const t = new Projectile(0, 0, 1, 0, 'bomb');
    applyWeaponProjectileStats(t, WEAPONS.bomb, S);
    expect(t.explosionRadius).toBe(WEAPONS.bomb.explosionRadius);
  });

  it('для обычной слезы горение остаётся 0', () => {
    const t = new Projectile(0, 0, 1, 0, 'tear');
    applyWeaponProjectileStats(t, WEAPONS.tears, S);
    expect(t.burnDuration).toBe(0);
  });

  it('damageMul множит урон и горение', () => {
    const t = new Projectile(0, 0, 1, 0, 'fireball');
    applyWeaponProjectileStats(t, WEAPONS.staff, { ...S, damageMul: 2 });
    expect(t.damage).toBe(WEAPONS.staff.damage * 2);
    expect(t.burnDamage).toBe((WEAPONS.staff.fireDmg ?? 1) * 2);
  });

  it('shotSpeedMul множит скорость; rangeMul множит жизнь', () => {
    const t = new Projectile(0, 0, 1, 0, 'tear');
    const baseLife = t.life;
    const baseSpeed = t.speed;
    applyWeaponProjectileStats(t, WEAPONS.tears, { ...S, shotSpeedMul: 1.5, rangeMul: 2 });
    expect(t.speed).toBeCloseTo(baseSpeed * 1.5, 5);
    expect(t.life).toBe(baseLife * 2);
  });
});

describe('projectileHitWall', () => {
  it('ловит стену по краю', () => {
    const room = makeRoom();
    const t = new Projectile(OX + TILE - 1, OY + (ROWS / 2) * TILE, 0, 0, 'tear');
    expect(projectileHitWall(t, room)).toBe(true);
  });

  it('пропускает центр пола', () => {
    const room = makeRoom();
    const t = new Projectile(OX + (COLS / 2) * TILE, OY + (ROWS / 2) * TILE, 0, 0, 'tear');
    expect(projectileHitWall(t, room)).toBe(false);
  });
});

describe('explodeBomb', () => {
  it('не делает ничего для не-бомбы', () => {
    const room = makeRoom();
    const t = new Projectile(0, 0, 0, 0, 'tear');
    const e = new Enemy(OX + 100, OY + 100, 'normal');
    const hpBefore = e.hp;
    room.enemies = [e];
    explodeBomb(room, t);
    expect(e.hp).toBe(hpBefore);
  });

  it('бомба бьёт врагов в радиусе и отбрасывает', () => {
    const room = makeRoom();
    const cx = OX + (COLS / 2) * TILE;
    const cy = OY + (ROWS / 2) * TILE;
    const t = new Projectile(cx, cy, 0, 0, 'bomb');
    t.explosionRadius = 80;
    const e = new Enemy(cx + 10, cy + 10, 'normal');
    const hpBefore = e.hp;
    room.enemies = [e];
    explodeBomb(room, t);
    expect(e.hp).toBeLessThan(hpBefore);
    expect(Math.abs(e.knx) + Math.abs(e.kny)).toBeGreaterThan(0);
  });

  it('бомба НЕ бьёт врагов за пределами радиуса', () => {
    const room = makeRoom();
    const cx = OX + (COLS / 2) * TILE;
    const cy = OY + (ROWS / 2) * TILE;
    const t = new Projectile(cx, cy, 0, 0, 'bomb');
    t.explosionRadius = 40;
    const e = new Enemy(cx + 500, cy + 500, 'normal'); // далеко
    const hpBefore = e.hp;
    room.enemies = [e];
    explodeBomb(room, t);
    expect(e.hp).toBe(hpBefore);
  });
});
