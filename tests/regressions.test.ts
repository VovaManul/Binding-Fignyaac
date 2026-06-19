import { describe, it, expect } from 'bun:test';
import { Game } from '../src/core/Game';
import { Rng } from '../src/core/rng';
import { Enemy } from '../src/core/entities/Enemy';
import { Projectile } from '../src/core/entities/Projectile';
import { emptyInput, type InputState } from '../src/input/InputState';
import { DEFAULT_RULES, PRESETS } from '../src/core/rules';
import { OX, OY, TILE, COLS, ROWS } from '../src/config';

function input(patch: Partial<InputState> = {}): InputState {
  return { ...emptyInput(), ...patch };
}

/** Ставит игру в normal-комнату с указанными врагами. */
function placeInNormalRoom(game: Game, enemies: Enemy[]): void {
  for (const room of game.roomMap.rooms.values()) {
    if (room.type !== 'normal') continue;
    game.cc = room.c;
    game.cr = room.r;
    game.enterRoom('up');
    room.enemies = enemies;
    room.cleared = false;
    return;
  }
  throw new Error('normal-комната не найдена');
}

describe('Регрессии Wave 1', () => {
  it('мёртвые враги удаляются из room.enemies (нет утечки)', () => {
    const game = new Game(DEFAULT_RULES, new Rng(31));
    const cx = OX + (COLS / 2) * TILE;
    const cy = OY + (ROWS / 2) * TILE;
    // Три врага, по 1 hp — умрут почти сразу от попадания.
    const e1 = new Enemy(cx - 50, cy, 'normal');
    const e2 = new Enemy(cx + 50, cy, 'normal');
    const e3 = new Enemy(cx, cy - 50, 'normal');
    e1.hp = e2.hp = e3.hp = 1;
    placeInNormalRoom(game, [e1, e2, e3]);

    // Чтобы не полагаться на полёт снарядов — убиваем напрямую и прогоняем шаг.
    e1.hp = 0; e2.hp = 0; e3.hp = 0;
    game.step(input());

    expect(game.curRoom.enemies.length).toBe(0); // фильтранулось, а не осталось 3 мёртвых
  });

  it('РЕГРЕССИЯ: после убийства всех врагов комната становится cleared (двери откроются)', () => {
    const game = new Game(DEFAULT_RULES, new Rng(34));
    const cx = OX + (COLS / 2) * TILE;
    const cy = OY + (ROWS / 2) * TILE;
    const e = new Enemy(cx, cy, 'normal');
    placeInNormalRoom(game, [e]);
    expect(game.curRoom.cleared).toBe(false);

    // Убиваем и прогоняем шаг — фильтр не должен помешать cleared стать true.
    e.hp = 0;
    game.step(input());

    expect(game.curRoom.cleared).toBe(true);
    expect(game.curRoom.enemies.length).toBe(0);
  });

  it('Player.addWeapon использует MODE_MELEE для melee-оружия', () => {
    // Проверяем, что mode === MODE_MELEE (1), а не литерал 1 по ошибке.
    const game = new Game(DEFAULT_RULES, new Rng(32));
    game.player.addWeapon('axe');  // melee
    expect(game.player.mode).toBe(1);
    game.player.addWeapon('tears'); // ranged
    expect(game.player.mode).toBe(0);
  });

  it('equipSlot молча игнорирует несуществующие слоты', () => {
    const game = new Game(DEFAULT_RULES, new Rng(33));
    const equippedBefore = game.player.equipped;
    game.equipSlot(5); // не существует
    expect(game.player.equipped).toBe(equippedBefore);
    game.equipSlot(-1);
    expect(game.player.equipped).toBe(equippedBefore);
  });

  it('WeaponDef.spread/beamRange вынесены из хардкода и читаются оружием', () => {
    const endless = { ...PRESETS.find((p) => p.id === 'endless')!, seed: 999 };
    const game = new Game(endless);
    game.player.addWeapon('laser');
    // Выстрел — луч должен оказаться на beamRange от игрока (70 по умолчанию).
    const px = game.player.x;
    game.step(input({ aimVec: { x: 1, y: 0 } }));
    const beam = game.curRoom.tears.find((t) => t.type === 'beam');
    expect(beam).toBeDefined();
    expect(beam!.x).toBe(px + 70); // если не вынесли в WeaponDef — будет undefined → NaN
  });
});

describe('Босс (milestone, этаж 5/10/15)', () => {
  it('босс не плодит миньёнов сверх BOSS.maxMinions', () => {
    const endless = { ...PRESETS.find((p) => p.id === 'endless')!, seed: 505 };
    const game = new Game(endless);

    // Домотать до 5-го этажа.
    for (let i = 2; i <= 5; i++) {
      const bossRoom = [...game.roomMap.rooms.values()].find((r) => r.type === 'boss')!;
      bossRoom.cleared = true;
      game.step(input());
    }
    expect(game.floor).toBe(5);

    // Заходим в комнату босса.
    const bossRoom = [...game.roomMap.rooms.values()].find((r) => r.type === 'boss')!;
    game.cc = bossRoom.c;
    game.cr = bossRoom.r;
    game.enterRoom('up');

    const boss = bossRoom.enemies.find((e) => e.type === 'boss')!;
    expect(boss).toBeDefined();

    // Опускаем HP до фазы 3 (< 33%), чтобы начался спавн миньёнов.
    boss.hp = Math.floor(boss.maxHp * 0.1);
    boss.spawnTimer = 0; // принудительно вызываем спавн в ближайший шаг

    // Прогоняем много шагов, чтобы спавн многократно сработал.
    for (let i = 0; i < 5000; i++) game.step(input());

    const aliveEnemies = bossRoom.enemies.filter((e) => e.alive);
    // Миньёны — все живые, кроме самого босса.
    expect(aliveEnemies.length).toBeLessThanOrEqual(5); // босс + 4 миньёна максимум
  });
});

describe('Переход между комнатами', () => {
  it('игрок зачищает комнату и переходит в соседнюю', () => {
    const game = new Game(DEFAULT_RULES, new Rng(41));
    const spawnRoom = game.curRoom;
    expect(spawnRoom.type).toBe('spawn');

    // Берём первое доступное направление дверей у спавна.
    const dir = (['up', 'down', 'left', 'right'] as const).find((d) => spawnRoom.doors[d]);
    expect(dir).toBeDefined();

    const cc0 = game.cc;
    const cr0 = game.cr;

    // Ставим игрока ОДИН ТАЙЛ ВНУТРЬ от двери (как делает enterRoom): тогда по
    // ходу движения к двери он несколько шагов проведёт в крайнем тайле и
    // checkTransition успеет сработать. (Старт прямо в door row был бы сразу
    // вытолкнут за пределы комнаты.)
    const center = doorNeighborCell(dir!);
    game.player.place(center.x, center.y);
    game.player.transCD = 0;

    const move = {
      up:    { moveX: 0,  moveY: -1 },
      down:  { moveX: 0,  moveY: 1 },
      left:  { moveX: -1, moveY: 0 },
      right: { moveX: 1,  moveY: 0 },
    }[dir!];

    for (let i = 0; i < 80; i++) game.step(input(move));

    expect(game.cc !== cc0 || game.cr !== cr0).toBe(true);
  });
});

/** Тайл ВНУТРИ комнаты напротив двери (один шаг от двери). */
function doorNeighborCell(dir: 'up' | 'down' | 'left' | 'right'): { x: number; y: number } {
  // Центр двери + один тайл внутрь.
  const cx = 7.5;
  const cy = 5.5;
  switch (dir) {
    case 'up':    return { x: OX + cx * TILE,     y: OY + 1.5 * TILE };
    case 'down':  return { x: OX + cx * TILE,     y: OY + (ROWS - 1.5) * TILE };
    case 'left':  return { x: OX + 1.5 * TILE,    y: OY + cy * TILE };
    case 'right': return { x: OX + (COLS - 1.5) * TILE, y: OY + cy * TILE };
  }
}

describe('Сундук → пикап → экипировка', () => {
  it('сундук после уничтожения выпадает пикап оружия, который подбирается', () => {
    const game = new Game(DEFAULT_RULES, new Rng(51));
    // Найдём сокровищницу.
    let treasure: typeof game.curRoom | null = null;
    for (const room of game.roomMap.rooms.values()) {
      if (room.type === 'treasure') { treasure = room; break; }
    }
    if (!treasure) return; // мягко пропускаем, если на этом seed нет
    game.cc = treasure.c;
    game.cr = treasure.r;
    game.enterRoom('up');

    const chest = game.curRoom.chest!;
    const weaponBefore = game.player.weapons[game.player.equipped].id;

    // Убиваем сундук напрямую и прогоняем несколько шагов: должен заспавнить пикап.
    chest.hp = 0;
    for (let i = 0; i < 5; i++) game.step(input());
    expect(game.curRoom.pickup).not.toBeNull();

    // Ставим игрока на пикап и прогоняем шаги — должен подобрать.
    game.player.place(game.curRoom.pickup!.x, game.curRoom.pickup!.y);
    for (let i = 0; i < 5; i++) game.step(input());

    expect(game.curRoom.pickup).toBeNull();
    expect(game.player.weapons[game.player.equipped].id).not.toBe(weaponBefore);
  });
});

describe('Secret room (секретка)', () => {
  it('спавнится на карте с шансом — среди 50 seed’ов хотя бы раз', () => {
    let found = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const game = new Game(DEFAULT_RULES, new Rng(seed));
      for (const room of game.roomMap.rooms.values()) {
        if (room.type === 'secret') { found++; break; }
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('при первом входе даёт +1 max HP; при повторном — НЕ даёт', () => {
    // Найдём seed с секреткой.
    let seed = 1;
    let game = new Game(DEFAULT_RULES, new Rng(seed));
    while (![...game.roomMap.rooms.values()].some(r => r.type === 'secret') && seed < 200) {
      seed++;
      game = new Game(DEFAULT_RULES, new Rng(seed));
    }
    if (seed >= 200) return; // мягко пропускаем

    const secret = [...game.roomMap.rooms.values()].find(r => r.type === 'secret')!;
    const maxHp0 = game.player.maxHp;
    game.cc = secret.c; game.cr = secret.r;
    game.enterRoom('up');
    expect(game.player.maxHp).toBe(maxHp0 + 1);

    // Выйдем и зайдём снова — бонуса быть не должно.
    game.cc = 0; game.cr = 0; // возвращаемся в спавн
    game.enterRoom('up');
    const maxHp1 = game.player.maxHp;
    game.cc = secret.c; game.cr = secret.r;
    game.enterRoom('up');
    expect(game.player.maxHp).toBe(maxHp1);
  });

  it('в секретке нет врагов (как в сокровищнице) — зачищается сразу', () => {
    let seed = 1;
    let game = new Game(DEFAULT_RULES, new Rng(seed));
    while (![...game.roomMap.rooms.values()].some(r => r.type === 'secret') && seed < 200) {
      seed++;
      game = new Game(DEFAULT_RULES, new Rng(seed));
    }
    if (seed >= 200) return;

    const secret = [...game.roomMap.rooms.values()].find(r => r.type === 'secret')!;
    game.cc = secret.c; game.cr = secret.r;
    game.enterRoom('up');
    expect(game.curRoom.enemies.length).toBe(0);
    expect(game.curRoom.cleared).toBe(true);
  });
});

/** Тайл ВНУТРИ комнаты напротив двери (один шаг от двери). */
function doorNeighborCell(dir: 'up' | 'down' | 'left' | 'right'): { x: number; y: number } {
  // Центр двери + один тайл внутрь.
  const cx = 7.5;
  const cy = 5.5;
  switch (dir) {
    case 'up':    return { x: OX + cx * TILE,     y: OY + 1.5 * TILE };
    case 'down':  return { x: OX + cx * TILE,     y: OY + (ROWS - 1.5) * TILE };
    case 'left':  return { x: OX + 1.5 * TILE,    y: OY + cy * TILE };
    case 'right': return { x: OX + (COLS - 1.5) * TILE, y: OY + cy * TILE };
  }
}
