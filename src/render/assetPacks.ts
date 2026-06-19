/** Наборы ассетов. Логика игры про них не знает — это чисто настройка рендера/HUD. */
export type AssetPackId = 'classic' | 'binding-2';

export interface AssetPack {
  id: AssetPackId;
  name: string;
  path: string;
}

export const ASSET_PACKS: readonly AssetPack[] = [
  { id: 'classic', name: 'Классика', path: 'assets' },
  { id: 'binding-2', name: 'Биндинг 2.0', path: 'assets-binding-2' },
];

export const DEFAULT_ASSET_PACK = ASSET_PACKS[0];
