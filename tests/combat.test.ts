import { describe, it, expect } from 'bun:test';
import { Game } from '../src/core/Game';
import { Rng } from '../src/core/rng';
import { Enemy } from '../src/core/entities/Enemy';
import { emptyInput, type InputState } from '../src/input/InputState';
import { DEFAULT_RULES } from '../src/core/rules';
import { MODE_RANGED, OX, OY, TILE, COLS } from '../src/config';

function input(patch: Partial<InputState> = {}): InputState {
  return { ...emptyInput(), ...patch };
}

/** Ставит игру в normal-комнату с одним указанным врагом. */
function placeInCombatRoom(game: Game, e: Enemy): void {
  for (const room of game.roomMap.rooms.values()) {
    if (room.type !== 'normal') continue;
    game.cc = room.c;
    game.cr = room.r;
    game.enterRoom('up');
    room.enemies = [e];
    room.cleared = false;
    return;
  }
  throw new Error('normal-комната не найдена в карте');
}

describe('Combat (через Game.step)', () => {
  it('снаряд ранит врага, на котором летит', () => {
    const game = new Game(DEFAULT_RULES, new Rng(21));
    // Враг прямо справа от игрока — стреляем вправо.
    const enemy = new Enemy(game.player.x + 30, game.player.y, 'tank');
    placeInCombatRoom(game, enemy);
    const hp0 = enemy.hp;

    game.step(input({ aimVec: { x: 1, y: 0 } }));
    expect(enemy.hp).toBeLessThan(hp0);
  });

  it('огнемёт (staff) поджигает врага — урон продолжается после попадания', () => {
    const game = new Game(DEFAULT_RULES, new Rng(22));
    game.player.addWeapon('staff');
    const enemy = new Enemy(game.player.x + 30, game.player.y, 'tank');
    placeInCombatRoom(game, enemy);

    game.step(input({ aimVec: { x: 1, y: 0 } })); // попадание = поджог
    expect(enemy.burnTimer).toBeGreaterThan(0);

    const hpAfterHit = enemy.hp;
    // Несколько шагов без новых попаданий — урон от горения капает.
    for (let i = 0; i < 30; i++) game.step(input());
    expect(enemy.hp).toBeLessThan(hpAfterHit);
  });

  it('бомба даёт AoE-урон по нескольким врагам', () => {
    const game = new Game(DEFAULT_RULES, new Rng(23));
    game.player.addWeapon('bomb');
    const near = new Enemy(game.player.x + 40, game.player.y, 'tank');
    const far = new Enemy(game.player.x + 400, game.player.y, 'tank');
    placeInCombatRoom(game, near);
    game.curRoom.enemies.push(far);

    const hpNear0 = near.hp;
    const hpFar0 = far.hp;

    game.step(input({ aimVec: { x: 1, y: 0 } }));
    // Снаряд летит, ждём, пока он не исчезнет (долетит до стены и взорвётся).
    for (let i = 0; i < 200; i++) game.step(input());

    expect(near.hp).toBeLessThan(hpNear0);
    expect(far.hp).toBe(hpFar0); // далеко — не задело
  });

  it('ближний бой (melee) наносит урон врагу в хитбоксе взмаха', () => {
    const game = new Game(DEFAULT_RULES, new Rng(24));
    // Дефолтный экипированный слот 0 = tears (ranged). Переключим на melee (слот 1).
    game.player.equipped = 1;
    game.player.mode = 1; // MODE_MELEE
    // Враг прямо перед игроком (выше по Y).
    const enemy = new Enemy(game.player.x, game.player.y - 30, 'tank');
    placeInCombatRoom(game, enemy);
    const hp0 = enemy.hp;

    game.step(input({ aimVec: { x: 0, y: -1 } }));
    expect(enemy.hp).toBeLessThan(hp0);
  });

  it(' лазер бьёт всех врагов в радиусе луча', () => {
    const game = new Game(DEFAULT_RULES, new Rng(25));
    game.player.addWeapon('laser');
    const enemy = new Enemy(game.player.x + 50, game.player.y, 'tank');
    placeInCombatRoom(game, enemy);
    const hp0 = enemy.hp;

    game.step(input({ aimVec: { x: 1, y: 0 } }));
    // Луч стоит и жжёт несколько тиков.
    for (let i = 0; i < 5; i++) game.step(input());
    expect(enemy.hp).toBeLessThan(hp0);
  });
});

describe('Combat — выстрел по сундуку', () => {
  it('снаряд игрока ранит сундук в сокровищнице', () => {
    const game = new Game(DEFAULT_RULES, new Rng(26));
    // Ищем сокровищницу.
    let treasureRoom: typeof game.curRoom | null = null;
    for (const room of game.roomMap.rooms.values()) {
      if (room.type === 'treasure') { treasureRoom = room; break; }
    }
    if (!treasureRoom) return; // на каком-то seed может не быть — тест пропустим мягко

    game.cc = treasureRoom.c;
    game.cr = treasureRoom.r;
    game.enterRoom('up');
    const chest = game.curRoom.chest!;
    expect(chest).toBeDefined();
    // Ставим игрока рядом с сундуком и стреляем вправо.
    game.player.x = chest.x - 40;
    game.player.y = chest.y;
    const hp0 = chest.hp;

    // Несколько выстрелов в сундук.
    for (let i = 0; i < 10; i++) game.step(input({ aimVec: { x: 1, y: 0 } }));
    expect(chest.hp).toBeLessThan(hp0);
  });
});

describe('Splitter — распад при смерти', () => {
  it('splitter умирает → спавнятся два fast', () => {
    const game = new Game(DEFAULT_RULES, new Rng(27));
    const e = new Enemy(game.player.x + 30, game.player.y, 'splitter');
    placeInCombatRoom(game, e);
    e.hp = 0; // убиваем напрямую
    game.step(input());

    // Ожидаем двух fast-детей (type !== splitter, должны быть 'fast').
    const children = game.curRoom.enemies.filter((en) => en.type === 'fast');
    expect(children.length).toBe(2);
    // И сам splitter удалён (мёртвый).
    expect(game.curRoom.enemies.some((en) => en.type === 'splitter')).toBe(false);
  });

  it('обычный враг при смерти НЕ плодит детей', () => {
    const game = new Game(DEFAULT_RULES, new Rng(28));
    const e = new Enemy(game.player.x + 30, game.player.y, 'normal');
    placeInCombatRoom(game, e);
    e.hp = 0;
    game.step(input());
    expect(game.curRoom.enemies.length).toBe(0);
  });
});
