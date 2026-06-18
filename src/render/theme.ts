/**
 * theme.ts — ВНЕШНИЙ ВИД мира (задел под кастомные ассеты).
 *
 * Сейчас «ассеты» — это просто цвета примитивов (квадраты/круги). Но рендер
 * берёт их отсюда, а не из хардкода, поэтому вид легко подменить, не трогая
 * логику: можно завести несколько тем или, в перспективе, расширить Theme
 * полями со спрайтами/текстурами (см. комментарий ниже) и научить
 * ThreeRenderer вешать их на материалы.
 */
export interface Theme {
  /** Цвета (0xRRGGBB) элементов мира. */
  bg: number;
  floorA: number;
  floorB: number;
  wall: number;
  door: number;
  playerRanged: number;
  playerMelee: number;
  enemyNormal: number;
  enemyFast: number;
  enemyBoss: number;
  tear: number;
  swing: number;
  flash: number; // цвет «вспышки» при попадании/неуязвимости

  // ── Задел на будущее (пока не используется) ───────────────
  // Чтобы перейти со сплошных цветов на картинки, добавь сюда, например:
  //   textures?: { floor?: string; wall?: string; player?: string; ... }
  // (URL/путь к изображению), загрузи их через THREE.TextureLoader в
  // ThreeRenderer и положи в material.map вместо/вместе с color.
}

/** Тема по умолчанию — текущая «тёмное подземелье». */
export const DEFAULT_THEME: Theme = {
  bg: 0x0a0a0f,
  floorA: 0x2e2e24,
  floorB: 0x353528,
  wall: 0x242436,
  door: 0x3a2e14,
  playerRanged: 0x2a6a9a,
  playerMelee: 0x9a3a2a,
  enemyNormal: 0x5a4a2e,
  enemyFast: 0x992222,
  enemyBoss: 0x5a0a0a,
  tear: 0x6699cc,
  swing: 0xcc8844,
  flash: 0xdddddd,
};
