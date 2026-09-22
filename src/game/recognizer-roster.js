import { DEFAULT_WORLD } from '../levels/scenario.js';
import { AIR_ESCORT_COUNT, airEscortSlot } from './carrier.js';
export function recognizerStarts(world = DEFAULT_WORLD) {
  const mazeStarts = world.RECOGNIZER_STARTS;
  return [
    ...mazeStarts.map((p, i) => ({ ...p, role: i < world.PURSUER_COUNT ? 'pursuer' : 'patrol' })),
    ...Array.from({ length: AIR_ESCORT_COUNT }, (_, escortIndex) => ({
      ...airEscortSlot(escortIndex, 0, world),
      role: 'escort',
      escortIndex,
    })),
  ];
}
export const RECOGNIZER_STARTS = recognizerStarts();
