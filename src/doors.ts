import { DOOR, DIR, OPP } from './constants';
import type { Dir, Doors } from './types';

export { DOOR, DIR, OPP };
export type { Dir, Doors };

/** Return the direction opposite to the given one */
export function oppositeDir(d: Dir): Dir {
  return OPP[d] as Dir;
}

/** Return the [dc, dr] offset for a direction */
export function dirOffset(d: Dir): [number, number] {
  return DIR[d];
}
