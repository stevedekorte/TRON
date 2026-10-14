export const ARENA_PLACEMENT = Object.freeze({ gapMeters: 24, gridMeters: 24, halfWidthMeters: 466 });
export function arenaSite(world) {
  const maze = world.MAZE_INSTANCES.find(m => m.kind === 'labyrinth');
  if (!maze) return null;
  const { gridMeters: grid, halfWidthMeters: half, gapMeters: gap } = ARENA_PLACEMENT;
  let x = Math.ceil((maze.bounds.maxX + gap + half) / grid) * grid;
  const s = maze.s;
  // Keep alternate layout seeds clear of the other mazes too.
  while (world.MAZE_INSTANCES.some(m => x + half + gap > m.bounds.minX && x - half - gap < m.bounds.maxX && s + half + gap > m.bounds.minS && s - half - gap < m.bounds.maxS)) x += grid;
  return { x, s };
}
