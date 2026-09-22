// USD per million input tokens; output is free under the configured JEV tariff.
export const JEV_INPUT_USD_PER_MILLION = 0.042;
export const inputCostUsd = (tokens) => (tokens * JEV_INPUT_USD_PER_MILLION) / 1e6;
export function estimatedInputCostUsd(payload) {
  return inputCostUsd(new TextEncoder().encode(JSON.stringify(payload)).length * 2 + 4096);
}
