import { jevQuestion } from '../../shared/jev-protocol.js';
import { inputCostUsd, estimatedInputCostUsd } from '../../shared/jev-pricing.js';
export { JEV_INPUT_USD_PER_MILLION } from '../../shared/jev-pricing.js';
const RATE_WINDOW_MS = 10000;
export class JevStats {
  constructor(clock = Date.now) {
    this.clock = clock;
    this.reset();
  }
  reset() {
    this.total = 0;
    this.costUsd = 0;
    this.estimated = 0;
    this.recent = [];
  }
  sent(snapshot) {
    const entry = {
      at: this.clock(),
      usd: estimatedInputCostUsd(jevQuestion(snapshot)),
      estimated: true,
    };
    this.total++;
    this.costUsd += entry.usd;
    this.estimated++;
    this.recent.push(entry.at);
    return entry;
  }
  settle(entry, usage) {
    if (Number.isSafeInteger(usage?.input_tokens) && usage.input_tokens >= 0) {
      const usd = inputCostUsd(usage.input_tokens);
      this.costUsd += usd - entry.usd;
      entry.usd = usd;
      if (entry.estimated) {
        entry.estimated = false;
        this.estimated--;
      }
    }
  }
  get value() {
    const now = this.clock();
    this.recent = this.recent.filter((t) => now - t < RATE_WINDOW_MS);
    return {
      requests: this.total,
      requestsPerSecond: this.recent.length / (RATE_WINDOW_MS / 1000),
      costUsd: Math.max(0, this.costUsd),
      estimatedRequests: this.estimated,
    };
  }
}
