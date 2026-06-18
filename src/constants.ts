// Canvas & grid dimensions
export const CW = 880;
export const CH = 660;
export const TILE = 44;
export const COLS = 15;
export const ROWS = 11;
export const RW = COLS * TILE;
export const RH = ROWS * TILE;
export const OX = (CW - RW) / 2;
export const OY = 80;

// Tile types
export const T_WALL = 0;
export const T_FLOOR = 1;
export const T_DOOR = 2;

// Combat modes
export const MODE_RANGED = 0;
export const MODE_MELEE = 1;

// Direction vectors
export const DIR: Record<string, [number, number]> = {
  up:    [0, -1],
  down:  [0, 1],
  left:  [-1, 0],
  right: [1, 0],
};

// Opposite direction lookup
export const OPP: Record<string, string> = {
  up:    'bottom',
  down:  'top',
  left:  'right',
  right: 'left',
};

// Door opening geometry (3 tiles wide at each cardinal edge)
export const DOOR = {
  up:    { cols: [6, 7, 8], row: 0,   cx: 7, cy: 0 },
  down:  { cols: [6, 7, 8], row: 10,  cx: 7, cy: 10 },
  left:  { col: 0,  rows: [4, 5, 6], cx: 0, cy: 5 },
  right: { col: 14, rows: [4, 5, 6], cx: 14, cy: 5 },
} as const;

// Grid generation bounds
export const MAP_RADIUS = 3;
export const MIN_ROOMS = 8;
export const EXTRA_ROOMS = 4;
