import { TACTICAL } from '../game/tactical.js';
const budgets = new WeakMap();
// Shared by air and ground units in this round; direct offline planner calls
// remain synchronous. Motor, sensing and collision updates are never skipped.
export function enemyPlanningBudget(run) {
  let budget = budgets.get(run);
  if (!budget || budget.time !== run.time) {
    budget = { time: run.time, remaining: TACTICAL.plansPerTick };
    budgets.set(run, budget);
  }
  return budget;
}
