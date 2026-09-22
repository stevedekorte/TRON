import { jevErrorCode, JEV_ERRORS } from '../../shared/jev-errors.js';
import { TACTICAL } from '../game/tactical.js';
/** HTTP and deadlines only. It cannot inspect or mutate a vehicle. */
export class JevTransport {
  constructor({
    fetchImpl = fetch,
    apiBase = '',
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
    timeoutMs = TACTICAL.requestTimeoutMs,
  } = {}) {
    Object.assign(this, {
      // Native Window.fetch requires the Window receiver in Safari. Keep the
      // injected function as a plain call, never a method on this transport.
      fetchImpl: (...args) => fetchImpl(...args),
      apiBase: apiBase.replace(/\/$/, ''),
      setTimer,
      clearTimer,
      timeoutMs,
    });
  }
  async request(snapshot, signal) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    const timer = this.setTimer(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.apiBase + '/api/jev/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
        signal: controller.signal,
      });
      const value = await response.json();
      if (!response.ok)
        throw Object.assign(new Error(value.error || 'Jev unavailable'), {
          code: jevErrorCode(response.status, value),
          httpStatus: response.status,
          retryAfter: Number(response.headers?.get('Retry-After') || value.retryAfter) || 0,
        });
      return value;
    } catch (error) {
      if (signal.aborted)
        throw Object.assign(new Error('Request cancelled'), { code: JEV_ERRORS.cancelled });
      if (Object.values(JEV_ERRORS).includes(error.code)) throw error;
      const code =
        controller.signal.aborted || ['AbortError', 'TimeoutError'].includes(error.name)
          ? JEV_ERRORS.timeout
          : JEV_ERRORS.unavailable;
      throw Object.assign(new Error(error.message || 'Jev unavailable', { cause: error }), {
        code,
      });
    } finally {
      this.clearTimer(timer);
      signal.removeEventListener('abort', cancel);
    }
  }
}
