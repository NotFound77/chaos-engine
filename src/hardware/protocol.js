/**
 * CHAOS ENGINE — Hardware Serial Protocol Parser & Formatter
 * Protocol specification:
 *   READY,CHAOS_ENGINE,<version>
 *   PARAM,<r>,<x0>,<N>
 *   EVENT,<START|RESET|COMPARE|ENCODER_PRESS>
 */

(function (root) {
  'use strict';

  /**
   * Parse a single line from Arduino serial stream
   * @param {string} rawLine
   * @returns {{ valid: boolean, type?: string, data?: any, raw: string, error?: string }}
   */
  function parseMessage(rawLine) {
    if (typeof rawLine !== 'string') {
      return { valid: false, raw: '', error: 'Input is not a string' };
    }

    const trimmed = rawLine.trim();
    if (!trimmed) {
      return { valid: false, raw: trimmed, error: 'Empty line' };
    }

    const parts = trimmed.split(',');
    const header = parts[0].toUpperCase();

    // 1. READY handshake
    if (header === 'READY') {
      const device = parts[1] || 'UNKNOWN';
      const version = parseInt(parts[2], 10) || 1;
      return {
        valid: true,
        type: 'READY',
        data: { device, version },
        raw: trimmed
      };
    }

    // 2. PARAM update: PARAM,r,x0,N
    if (header === 'PARAM') {
      if (parts.length < 4) {
        return { valid: false, raw: trimmed, error: 'PARAM message requires 3 values (r, x0, N)' };
      }

      const r = parseFloat(parts[1]);
      const x0 = parseFloat(parts[2]);
      const n = parseInt(parts[3], 10);

      if (Number.isNaN(r) || Number.isNaN(x0) || Number.isNaN(n)) {
        return { valid: false, raw: trimmed, error: 'PARAM contains non-numeric values' };
      }

      // Clamp to physical ranges
      const clampedR = Math.max(0, Math.min(4, r));
      const clampedX0 = Math.max(0, Math.min(1, x0));
      const clampedN = Math.max(5, Math.min(500, n));

      return {
        valid: true,
        type: 'PARAM',
        data: {
          r: clampedR,
          x0: clampedX0,
          n: clampedN
        },
        raw: trimmed
      };
    }

    // 3. EVENT trigger: EVENT,START | EVENT,RESET | EVENT,COMPARE | EVENT,ENCODER_PRESS
    if (header === 'EVENT') {
      if (parts.length < 2) {
        return { valid: false, raw: trimmed, error: 'EVENT message requires event name' };
      }

      const eventName = parts[1].toUpperCase();
      const validEvents = ['START', 'RESET', 'COMPARE', 'ENCODER_PRESS', 'PAUSE'];

      if (!validEvents.includes(eventName)) {
        return { valid: false, raw: trimmed, error: `Unrecognized event: ${eventName}` };
      }

      return {
        valid: true,
        type: 'EVENT',
        data: {
          event: eventName
        },
        raw: trimmed
      };
    }

    return { valid: false, raw: trimmed, error: `Unknown packet header: ${header}` };
  }

  /**
   * Helper to format parameter string
   */
  function formatParam(r, x0, n) {
    return `PARAM,${Number(r).toFixed(3)},${Number(x0).toFixed(3)},${Math.round(n)}`;
  }

  const ChaosProtocol = {
    parseMessage,
    formatParam
  };

  root.ChaosProtocol = ChaosProtocol;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChaosProtocol;
  }
})(typeof window !== 'undefined' ? window : globalThis);
