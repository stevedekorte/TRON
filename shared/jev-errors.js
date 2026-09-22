export const JEV_ERRORS = Object.freeze({
  timeout: 'timeout',
  cancelled: 'cancelled',
  unavailable: 'unavailable',
  limited: 'limited',
  invalid: 'invalid',
});
export function jevErrorCode(status, value = {}) {
  if (Object.values(JEV_ERRORS).includes(value.code)) return value.code;
  if (status === 429) return JEV_ERRORS.limited;
  // Compatibility with an older deployed relay. New relays always send a code.
  if (status === 504 || /timed?\s*out|timeout/i.test(value.error || '')) return JEV_ERRORS.timeout;
  return JEV_ERRORS.unavailable;
}
export function errorBody(status, value) {
  return value.error ? { ...value, code: jevErrorCode(status, value) } : value;
}
