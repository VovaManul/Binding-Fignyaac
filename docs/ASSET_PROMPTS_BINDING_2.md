# Промпты для ассетов: «Биндинг 2.0»

Этот файл нужен, чтобы сгенерировать второй набор ассетов в стиле постера
`docs/assets/binding_fignyashka.png`, но в формате, который легко положить в игру
и при необходимости вырезать руками.

## Как пользоваться

1. В генераторе сначала загрузи постер `docs/assets/binding_fignyashka.png` как
   style reference, если сервис это поддерживает.
2. Скопируй **базовый промпт** ниже в начало каждой генерации.
3. Ниже по файлу копируй промпт конкретного ассета.
4. Сохраняй результат ровно с указанным именем файла.

Если генератор плохо делает прозрачный фон, проси однотонный chroma key:
`pure #00ff00 background, no shadow, no glow touching the background`, затем
удаляй фон любым инструментом. Для игры лучше PNG с alpha.

## Базовый промпт

```text
Use the uploaded poster "Биндим Фигняшку" as the style reference only.

Create one game asset for a top-down roguelike called "Биндинг 2.0".
Style: grotesque dark cartoon dungeon art, chunky hand-painted shapes, high contrast, juicy slime colors, thick uneven black-purple outlines, expressive silly-horror faces, grimy stone dungeon details, saturated neon accents, readable silhouette at small size.

Technical requirements:
- One isolated asset only, centered.
- Transparent PNG background with clean alpha.
- If transparent background is not possible: pure #00ff00 chroma key background, no gradients, no contact shadow, no glow touching the background.
- No text, no letters, no watermark, no UI frame, no mockup, no floor under the object, no baked shadow, unless the specific prompt asks for logo/menu background/floor/wall/shadow.
- Keep the whole object inside the canvas with 8-12% padding.
- Use the requested exact canvas size and filename.
- Front-facing billboard sprite for characters, slightly top-down camera feel, feet aligned near the bottom edge.
- Same lighting, palette, outline thickness, and detail density across all assets.
- Make it easy to cut out: crisp silhouette, transparent outside pixels, no loose dust outside the silhouette.

Negative prompt:
photorealistic, realistic gore, anime, flat vector icon, pixel art, low contrast, blurry edges, tiny unreadable details, background scene, multiple objects, text, signature, watermark, drop shadow, floor shadow, square UI border, cropped body, cut off feet
```

## Персонажи и враги

### `player-ranged.png` — игрок с дальним оружием, 192x256

```text
Asset: player-ranged.png, canvas 192x256.

Small grotesque hero, huge uneven eyes, patched purple hood with little horns, anxious grin, compact body, holding a weird toy-like slime pistol or water gun pointed diagonally down-right. Blue/cyan weapon glow, tiny dungeon grime, funny horror expression. Full body, front-facing billboard sprite, feet at the bottom edge, transparent background.
```

### `player-melee.png` — игрок с ближним оружием, 192x256

```text
Asset: player-melee.png, canvas 192x256.

Same hero as player-ranged, same face and purple hood, but holding a ridiculous melee weapon: toilet brush, rusty knife, or plunger club. Warmer red/orange accents, aggressive grin, ready to swing. Full body, front-facing billboard sprite, feet at the bottom edge, transparent background.
```

### `enemy-normal.png` — обычный враг, 192x256

```text
Asset: enemy-normal.png, canvas 192x256.

Round lumpy dungeon monster, terracotta-pink skin, one lazy eye and one tiny eye, small teeth, stubby legs, goofy but hostile. Thick black-purple outline, slime spots, readable chunky silhouette. Full body, front-facing billboard sprite, feet at the bottom edge, transparent background.
```

### `enemy-fast.png` — быстрый враг, 160x213

```text
Asset: enemy-fast.png, canvas 160x213.

Small twitchy fast monster, red bug-like gobbet, long thin legs, bulging eyes, frantic expression, motion-ready pose but not blurred. Bright red and magenta accents, sharp silhouette. Full body, front-facing billboard sprite, feet at the bottom edge, transparent background.
```

### `enemy-boss.png` — босс, 288x384

```text
Asset: enemy-boss.png, canvas 288x384.

Huge grotesque boss head-body hybrid, swollen pink-brown flesh, mismatched giant eyes, crown made of junk metal, open screaming mouth, tiny arms with a plunger hammer. Dark dungeon grime, purple slime rim light, very readable massive silhouette. Full body, front-facing billboard sprite, base at bottom edge, transparent background.
```

### `enemy-charger.png` — рывковый враг, 192x256

```text
Asset: enemy-charger.png, canvas 192x256.

Aggressive charger monster, red-orange flesh, low hunched body, one horn or metal spike on forehead, angry slit eyes, oversized jaw, pose leaning forward like it is about to rush. Thick outline, neon orange highlights. Full body, front-facing billboard sprite, feet at bottom edge, transparent background.
```

### `enemy-tank.png` — тяжёлый враг, 224x288

```text
Asset: enemy-tank.png, canvas 224x288.

Heavy tank monster, bulky stone-and-flesh body, cracked skull plates, slow stupid face, tiny eyes, big square jaw, metal rivets embedded in skin. Dark brown, grey, bruised purple palette. Full body, front-facing billboard sprite, feet/base at bottom edge, transparent background.
```

### `enemy-shooter.png` — стрелок, 192x256

```text
Asset: enemy-shooter.png, canvas 192x256.

Shooter monster, bluish sickly body, huge single watery eye, tiny nozzle mouth or fish-gun growth, cheeks full of glowing slime projectile. Cyan/green spit glow, nervous mean expression. Full body, front-facing billboard sprite, feet at bottom edge, transparent background.
```

## Окружение

### `floor.png` — бесшовный пол, 256x256

```text
Asset: floor.png, canvas 256x256.

Seamless tileable dungeon floor texture, top-down stone slabs from the poster style, dark grey-brown stones, subtle purple grime, tiny cracks, small slime stains, no strong directional light, no objects, no text. Must tile perfectly on all edges.
```

### `wall.png` — бесшовная стена, 256x256

```text
Asset: wall.png, canvas 256x256.

Seamless tileable dungeon wall brick texture, cold blue-grey bricks, black-purple mortar, moss and slime in cracks, hand-painted chunky style, no perspective object, no text. Must tile perfectly on all edges.
```

### `door-closed.png` — закрытая дверь, 192x256

```text
Asset: door-closed.png, canvas 192x256.

Closed dungeon doorway sprite, arched stone frame, chunky wooden planks, heavy golden latch/bar, purple slime outline, front-facing vertical billboard object. Transparent background outside the door frame, no floor, no shadow.
```

### `door-open.png` — открытая дверь, 192x256

```text
Asset: door-open.png, canvas 192x256.

Open dungeon doorway sprite, arched stone frame, dark black interior void, broken wooden bits, purple slime rim light, front-facing vertical billboard object. Transparent background outside the door frame, no floor, no shadow.
```

### `chest.png` — сундук, 192x192

```text
Asset: chest.png, canvas 192x192.

Treasure chest object, red-brown wood, gold metal bands, one goofy eye-shaped lock, tiny slime drips, cute-horror style from the poster. Isolated object, three-quarter top-down object view, transparent background, no shadow.
```

### `pickup.png` — универсальный пикап, 128x128

```text
Asset: pickup.png, canvas 128x128.

Floating weapon pickup marker, glowing golden-purple diamond with slime sparkle, chunky outline, readable at small size. Isolated object, transparent background, no shadow.
```

## Снаряды и эффекты

### `tear.png` — слеза, 64x64

```text
Asset: tear.png, canvas 64x64.

Single glowing blue tear projectile, chunky droplet shape, white highlight, cyan edge glow contained inside transparent canvas. No trail, no shadow, transparent background.
```

### `fireball.png` — огненный шар, 64x64

```text
Asset: fireball.png, canvas 64x64.

Single grotesque fireball projectile, orange-red slime flame orb, white-yellow hot center, small black-purple outline, contained glow, transparent background, no trail.
```

### `beam.png` — луч лазера, 128x128

```text
Asset: beam.png, canvas 128x128.

Laser impact/beam blob sprite, bright white-cyan center with electric blue-purple rim, circular radial energy burst suitable for additive blending, transparent background, no hard square edges.
```

### `muzzle.png` — вспышка выстрела, 128x128

```text
Asset: muzzle.png, canvas 128x128.

Muzzle flash effect sprite, white-hot center, yellow-orange starburst, purple edge sparks, soft radial alpha, designed for additive blending. Transparent background.
```

### `spark.png` — искра попадания, 128x128

```text
Asset: spark.png, canvas 128x128.

Hit spark effect sprite, jagged white-yellow impact burst with tiny purple fragments, clear center, fades to transparent edges, designed for additive blending. Transparent background.
```

### `puff.png` — дымок смерти, 128x128

```text
Asset: puff.png, canvas 128x128.

Cartoon death puff cloud, grey-white smoke with purple grime, soft edges, funny splat-cloud shape, fades to transparent, no hard outline outside the cloud. Transparent background.
```

### `shadow.png` — тень, 128x64

```text
Asset: shadow.png, canvas 128x64.

Soft oval blob shadow, black center fading smoothly to full transparency, no colored tint, no hard edge. Transparent PNG, exactly one horizontal ellipse.
```

## HUD и меню

### `logo.png` — логотип, 900x220

```text
Asset: logo.png, canvas 900x220.

Logo text in Russian: "Биндим Фигняшку".
Use the exact poster lettering vibe: chunky slime letters, green top word "Биндим", orange-yellow bottom word "Фигняшку", purple slime outline, black thick shadow. Transparent background. No extra characters, no subtitle, no watermark.
```

### `menu-bg.png` — фон меню, 880x660

```text
Asset: menu-bg.png, canvas 880x660.

Dark dungeon menu background in the same poster style, top-down room fragments, dim torches, purple slime, scattered silly-horror props. No text, no logo, no centered character, leave the central area readable for UI overlay. Full rectangular background, not transparent.
```

### `heart-full.png` — полное сердце, 48x48

```text
Asset: heart-full.png, canvas 48x48.

Full HP heart icon, red fleshy cartoon heart, thick dark outline, tiny slime highlight, readable at 24 px. Transparent background, no shadow.
```

### `heart-half.png` — половина сердца, 48x48

```text
Asset: heart-half.png, canvas 48x48.

Half HP heart icon matching heart-full, left half full red flesh, right half dark empty husk, thick dark outline, readable at 24 px. Transparent background, no shadow.
```

### `heart-empty.png` — пустое сердце, 48x48

```text
Asset: heart-empty.png, canvas 48x48.

Empty HP heart icon matching heart-full, dark cracked heart outline with hollow center, subtle purple grime, readable at 24 px. Transparent background, no shadow.
```

### `icon-ranged.png` — иконка дальнего режима, 48x48

```text
Asset: icon-ranged.png, canvas 48x48.

Ranged mode HUD icon, tiny goofy slime pistol firing one blue tear, thick outline, high contrast, readable at 24 px. Transparent background, no shadow.
```

### `icon-melee.png` — иконка ближнего режима, 48x48

```text
Asset: icon-melee.png, canvas 48x48.

Melee mode HUD icon, tiny ridiculous knife/plunger/brush weapon, red-orange accent, thick outline, high contrast, readable at 24 px. Transparent background, no shadow.
```

## Иконки оружия

### `weapon-icon-tears.png`, 48x48

```text
Asset: weapon-icon-tears.png, canvas 48x48.

Weapon icon for "Слёзы": single blue tear orb with white highlight, chunky outline, readable at 24 px. Transparent background, no shadow.
```

### `weapon-icon-melee.png`, 48x48

```text
Asset: weapon-icon-melee.png, canvas 48x48.

Weapon icon for "Кулак": goofy clenched fist, bruised peach color, thick dark outline, tiny slime detail, readable at 24 px. Transparent background, no shadow.
```

### `weapon-icon-shotgun.png`, 48x48

```text
Asset: weapon-icon-shotgun.png, canvas 48x48.

Weapon icon for "Дробовик": three small glowing pellets spreading outward, yellow-orange centers, dark outline, readable at 24 px. Transparent background, no shadow.
```

### `weapon-icon-axe.png`, 48x48

```text
Asset: weapon-icon-axe.png, canvas 48x48.

Weapon icon for "Топор": rusty cartoon axe with chipped metal head and short handle, purple grime, thick outline, readable at 24 px. Transparent background, no shadow.
```

### `weapon-icon-staff.png`, 48x48

```text
Asset: weapon-icon-staff.png, canvas 48x48.

Weapon icon for "Посох": crooked wooden staff with glowing orange fire gem, tiny slime drips, thick outline, readable at 24 px. Transparent background, no shadow.
```

### `weapon-icon-whip.png`, 48x48

```text
Asset: weapon-icon-whip.png, canvas 48x48.

Weapon icon for "Хлыст": curled leather whip, exaggerated curve, warm brown with purple rim, thick outline, readable at 24 px. Transparent background, no shadow.
```

### `weapon-icon-bomb.png`, 48x48

```text
Asset: weapon-icon-bomb.png, canvas 48x48.

Weapon icon for "Бомба": round black cartoon bomb with lit fuse, orange spark, silly eye-like rivet, thick outline, readable at 24 px. Transparent background, no shadow.
```

### `weapon-icon-boomerang.png`, 48x48

```text
Asset: weapon-icon-boomerang.png, canvas 48x48.

Weapon icon for "Бумеранг": crooked wooden boomerang with teeth marks and purple slime stripe, thick outline, readable at 24 px. Transparent background, no shadow.
```

### `weapon-icon-laser.png`, 48x48

```text
Asset: weapon-icon-laser.png, canvas 48x48.

Weapon icon for "Лазер": compact blue-white laser emitter crystal or ray gun barrel, cyan glow contained inside icon, thick outline, readable at 24 px. Transparent background, no shadow.
```

## После генерации

Сложи файлы второго набора в отдельную папку, например:

```text
src/assets-binding-2/
```

Потом можно добавить выбор в меню:

- `Классика` -> текущая папка `src/assets/`;
- `Биндинг 2.0` -> новая папка `src/assets-binding-2/`.

Когда ассеты будут готовы, самый чистый следующий шаг в коде: дать `Assets` параметр
`packPath` и прокинуть выбранный пак из `StartMenu` в `ThreeRenderer`/`HudOverlay`.
