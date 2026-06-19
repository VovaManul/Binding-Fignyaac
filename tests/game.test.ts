import { describe, it, expect } from 'bun:test';
import { Game } from '../src/core/Game';
import { Rng } from '../src/core/rng';
import { Enemy } from '../src/core/entities/Enemy';
import { collidesWall } from '../src/core/systems/collision';
import { emptyInput, type InputState } from '../src/input/InputState';
import { DEFAULT_RULES, PRESETS } from '../src/core/rules';
import { MODE_RANGED, MODE_MELEE, OX, OY, TILE, COLS, RW } from '../src/config';

function input(patch: Partial<InputState> = {}): InputState {
  return { ...emptyInput(), ...patch };
}

describe('Game', () => {
  it('РЕГРЕССИЯ: конструируется без ошибок и игрок появляется не в стене', () => {
    const game = new Game(DEFAULT_RULES, new Rng(1));
    expect(game.curRoom).toBeDefined();
    expect(game.curRoom.type).toBe('spawn');
    expect(collidesWall(game.player.box, game.curRoom)).toBe(false);
  });

  it('600 пустых шагов не падают, игрок не застревает в стене, HP цело на спавне', () => {
    const game = new Game(DEFAULT_RULES, new Rng(2));
    const hp0 = game.player.hp;
    for (let i = 0; i < 600; i++) game.step(input());
    expect(collidesWall(game.player.box, game.curRoom)).toBe(false);
    expect(game.player.hp).toBe(hp0); // на спавне врагов нет
    expect(game.gameOver).toBe(false);
  });

  it('смена оружия по toggleWeapon', () => {
    const game = new Game(DEFAULT_RULES, new Rng(3));
    expect(game.player.mode).toBe(MODE_RANGED);
    game.consumeActions(input({ toggleWeapon: true }));
    expect(game.player.mode).toBe(MODE_MELEE);
    game.consumeActions(input({ toggleWeapon: true }));
    expect(game.player.mode).toBe(MODE_RANGED);
  });

  it('стрельба создаёт снаряд, который потом исчезает', () => {
    const game = new Game(DEFAULT_RULES, new Rng(4));
    game.step(input({ aimDir: 'right' }));
    expect(game.curRoom.tears.length).toBe(1);
    // Снаряд летит вправо и со временем гаснет (стена/время жизни).
    for (let i = 0; i < 200; i++) game.step(input());
    expect(game.curRoom.tears.length).toBe(0);
  });

  it('РЕГРЕССИЯ: комната без врагов (сокровищница) зачищается при входе — иначе двери не открыть', () => {
    // Ищем seed, где в карте есть сокровищница.
    let tested = false;
    for (let seed = 1; seed <= 200 && !tested; seed++) {
      const game = new Game(DEFAULT_RULES, new Rng(seed));
      for (const room of game.roomMap.rooms.values()) {
        if (room.type !== 'treasure') continue;
        game.cc = room.c;
        game.cr = room.r;
        game.enterRoom('up');
        expect(room.enemies.length).toBe(0);
        expect(room.cleared).toBe(true); // иначе игрок застрянет без дверей
        tested = true;
        break;
      }
    }
    expect(tested).toBe(true); // среди 200 seed сокровищница точно нашлась
  });

  it('РЕГРЕССИЯ: кнокбэк не выбрасывает врага сквозь стену (нет софт-лока)', () => {
    const game = new Game(DEFAULT_RULES, new Rng(7));
    // Переносим игру в любую боевую (normal) комнату.
    let placed = false;
    for (const room of game.roomMap.rooms.values()) {
      if (room.type !== 'normal') continue;
      game.cc = room.c;
      game.cr = room.r;
      game.enterRoom('up');
      placed = true;
      break;
    }
    expect(placed).toBe(true);

    const room = game.curRoom;
    // Один контролируемый враг у правой стены, кнокбэк направлен В стену.
    const e = new Enemy(OX + (COLS - 2) * TILE + TILE / 2, OY + 5 * TILE + TILE / 2, 'normal');
    e.knx = 50; // заведомо больше толщины стены (1 тайл)
    e.kny = 0;
    room.enemies = [e];

    for (let i = 0; i < 40; i++) game.step(emptyInput());

    expect(collidesWall(e.box, room)).toBe(false); // остался внутри и достижим
    expect(e.x).toBeLessThan(OX + RW);              // не вылетел за правую стену
  });

  it('правила уровня влияют на забег: HP игрока и размер карты', () => {
    const hardcore = PRESETS.find((p) => p.id === 'hardcore')!;
    const big = PRESETS.find((p) => p.id === 'big')!;

    const gHard = new Game(hardcore, new Rng(11));
    expect(gHard.player.maxHp).toBe(hardcore.player.maxHp); // меньше базовых 6

    // «Большой данжен» в среднем даёт больше комнат, чем «Стандарт».
    const avg = (rules: typeof big) => {
      let sum = 0;
      for (let s = 1; s <= 20; s++) sum += new Game(rules, new Rng(s)).roomMap.rooms.size;
      return sum / 20;
    };
    expect(avg(big)).toBeGreaterThan(avg(DEFAULT_RULES));
  });

  it('фикс-сид даёт одинаковую карту каждый раз — в т.ч. после reset()', () => {
    const daily = PRESETS.find((p) => p.id === 'daily')!;
    const a = new Game(daily);
    const keys = [...a.roomMap.rooms.keys()].sort();

    // другой экземпляр — та же карта
    const b = new Game(daily);
    expect([...b.roomMap.rooms.keys()].sort()).toEqual(keys);

    // РЕГРЕССИЯ: после рестарта по [R] фикс-сид воспроизводит тот же данжен
    a.gameOver = true;
    a.reset();
    expect([...a.roomMap.rooms.keys()].sort()).toEqual(keys);
  });

  it('reset() возвращает чистое состояние', () => {
    const game = new Game(DEFAULT_RULES, new Rng(5));
    game.player.hp = 1;
    game.gameOver = true;
    game.reset();
    expect(game.gameOver).toBe(false);
    expect(game.player.hp).toBe(game.player.maxHp);
    expect(game.cc).toBe(0);
    expect(game.cr).toBe(0);
  });

  it('РЕГРЕССИЯ: бесконечный спуск применяет усиление врагов при спавне комнат', () => {
    const endless = { ...PRESETS.find((p) => p.id === 'endless')!, seed: 100 };
    const game = new Game(endless);

    for (let targetFloor = 2; targetFloor <= 5; targetFloor++) {
      const bossRoom = [...game.roomMap.rooms.values()].find((room) => room.type === 'boss')!;
      bossRoom.cleared = true;
      game.step(input());
      expect(game.floor).toBe(targetFloor);
    }

    const bossRoom = [...game.roomMap.rooms.values()].find((room) => room.type === 'boss')!;
    game.cc = bossRoom.c;
    game.cr = bossRoom.r;
    game.enterRoom('up');

    const boss = bossRoom.enemies.find((e) => e.type === 'boss')!;
    expect(boss.maxHp).toBeGreaterThan(10);
  });

  it('снаряд берёт урон из выбранного оружия', () => {
    const game = new Game(DEFAULT_RULES, new Rng(12));
    game.player.addWeapon('boomerang');

    game.step(input({ aimDir: 'right' }));

    expect(game.curRoom.tears[0].type).toBe('boomerang');
    expect(game.curRoom.tears[0].damage).toBe(2);
  });

  it('РЕГРЕССИЯ: эффект снаряда не зависит от смены оружия после выстрела', () => {
    const game = new Game(DEFAULT_RULES, new Rng(13));
    game.player.addWeapon('staff');

    const enemy = new Enemy(game.player.x + 7, game.player.y, 'tank');
    game.curRoom.enemies = [enemy];

    game.step(input({ aimDir: 'right' }));
    expect(enemy.burnTimer).toBeGreaterThan(0);

    const hpAfterHit = enemy.hp;
    game.player.addWeapon('tears');
    for (let i = 0; i < 10; i++) game.step(input());

    expect(enemy.hp).toBeLessThan(hpAfterHit);
  });
});
