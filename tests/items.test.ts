import { describe, it, expect } from 'bun:test';
import { Game } from '../src/core/Game';
import { Rng } from '../src/core/rng';
import { emptyInput, type InputState } from '../src/input/InputState';
import { DEFAULT_RULES } from '../src/core/rules';
import { ITEMS, applyItem, ALL_ITEM_IDS } from '../src/core/items';
import { NEUTRAL_STATS } from '../src/core/entities/Player';
import { Pickup } from '../src/core/entities/Pickup';
import { OX, OY, TILE, COLS, ROWS } from '../src/config';

function input(patch: Partial<InputState> = {}): InputState {
  return { ...emptyInput(), ...patch };
}

describe('Предметы', () => {
  it('applyItem модифицирует статы дельтой', () => {
    const s = { ...NEUTRAL_STATS };
    applyItem(s, ITEMS['cricket-head'], () => {});
    expect(s.damageMul).toBeCloseTo(1.5, 5);
    expect(s.fireRateMul).toBe(1); // не должно было измениться

    applyItem(s, ITEMS['sad-onion'], () => {});
    expect(s.fireRateMul).toBeCloseTo(1.35, 5);

    // Стак того же предмета.
    applyItem(s, ITEMS['cricket-head'], () => {});
    expect(s.damageMul).toBeCloseTo(2.0, 5);
  });

  it('applyItem с maxHpBonus растит HP через колбэк', () => {
    let hp = 6, maxHp = 6;
    applyItem({ ...NEUTRAL_STATS }, ITEMS['blood-penny'], (bonus) => {
      maxHp += bonus;
      hp = Math.min(maxHp, hp + bonus);
    });
    expect(maxHp).toBe(8);
    expect(hp).toBe(8);
  });

  it('ALL_ITEM_IDS содержит все предметы из ITEMS', () => {
    expect(ALL_ITEM_IDS.length).toBe(Object.keys(ITEMS).length);
  });
});

describe('Подбор предмета через Game', () => {
  it('предмет лежит на полу, игрок его подбирает — статы меняются', () => {
    const game = new Game(DEFAULT_RULES, new Rng(71));
    // Найдём сокровищницу или просто normal — главное, чтобы у комнаты был pickup.
    const room = game.curRoom;
    const before = { damageMul: game.player.stats.damageMul };

    room.pickup = Pickup.item(game.player.x, game.player.y, 'cricket-head');
    game.step(input());

    expect(room.pickup).toBeNull();
    expect(game.player.stats.damageMul).toBeGreaterThan(before.damageMul);
  });

  it('предмет-лечение растит maxHp', () => {
    const game = new Game(DEFAULT_RULES, new Rng(72));
    const room = game.curRoom;
    const maxHp0 = game.player.maxHp;
    const hp0 = game.player.hp;

    room.pickup = Pickup.item(game.player.x, game.player.y, 'blood-penny');
    game.step(input());

    expect(game.player.maxHp).toBe(maxHp0 + 2);
    expect(game.player.hp).toBe(Math.min(maxHp0 + 2, hp0 + 2));
  });

  it('сундук может дропнуть как оружие, так и предмет', () => {
    // На нескольких seed'ах должно выпадать хотя бы по разу каждого типа.
    let weaponDrops = 0;
    let itemDrops = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const game = new Game(DEFAULT_RULES, new Rng(seed));
      // Найдём сокровищницу.
      let treasure = null;
      for (const r of game.roomMap.rooms.values()) {
        if (r.type === 'treasure') { treasure = r; break; }
      }
      if (!treasure) continue;
      game.cc = treasure.c;
      game.cr = treasure.r;
      game.enterRoom('up');
      const chest = game.curRoom.chest!;
      chest.hp = 0;
      for (let i = 0; i < 3; i++) game.step(input());
      if (!game.curRoom.pickup) continue;
      if (game.curRoom.pickup.kind === 'weapon') weaponDrops++;
      else itemDrops++;
    }
    expect(weaponDrops).toBeGreaterThan(0);
    expect(itemDrops).toBeGreaterThan(0);
  });
});
