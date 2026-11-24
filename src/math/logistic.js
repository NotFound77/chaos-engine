/**
 * CHAOS ENGINE — Logistic Map Mathematical Core
 * Scientific implementation using IEEE 754 double-precision floating-point arithmetic.
 */

(function (root) {
  'use strict';

  /**
   * Logistic map recurrence function:
   * x_{n+1} = r * x_n * (1 - x_n)
   * @param {number} r Growth parameter in [0, 4]
   * @param {number} x State value in [0, 1]
   * @returns {number} Next state value in [0, 1]
   */
  function logistic(r, x) {
    const next = r * x * (1 - x);
    // Numerical safety guard against minor floating point drift beyond [0, 1]
    if (next < 0 && next > -1e-14) return 0;
    if (next > 1 && next < 1 + 1e-14) return 1;
    return next;
  }

  /**
   * First derivative of the logistic function:
   * f'(x) = r * (1 - 2x)
   * @param {number} r Growth parameter
   * @param {number} x State value
   * @returns {number}
   */
  function derivative(r, x) {
    return r * (1 - 2 * x);
  }

  /**
   * Numerically compute the sequence x(0), x(1), ..., x(N)
   * @param {number} r Growth parameter [0, 4]
   * @param {number} x0 Initial condition [0, 1]
   * @param {number} n Number of iterations [5, 500]
   * @returns {Float64Array} Typed array of length n + 1
   */
  function iterate(r, x0, n) {
    const count = Math.max(1, Math.min(2000, Math.floor(n)));
    const seq = new Float64Array(count + 1);
    seq[0] = Math.max(0, Math.min(1, x0));
    let x = seq[0];

    for (let i = 0; i < count; i++) {
      x = r * x * (1 - x);
      if (x < 0 && x > -1e-14) x = 0;
      if (x > 1 && x < 1 + 1e-14) x = 1;
      seq[i + 1] = x;
      if (!Number.isFinite(x)) {
        seq[i + 1] = 0;
        break;
      }
    }
    return seq;
  }

  /**
   * Compute valid fixed points in the physical domain [0, 1]
   * x* = 0 for all r
   * x* = (r - 1) / r only when r > 1 (at r=1, coincides with 0)
   * @param {number} r Growth parameter
   * @returns {Array<{ x: number, derivative: number, absDerivative: number, stability: string, label: string }>}
   */
  function fixedPoints(r) {
    const pts = [];
    const eps = 1e-9;

    // Fixed point 1: x* = 0
    const d0 = derivative(r, 0);
    const absD0 = Math.abs(d0);
    let stab0 = 'neutral';
    if (absD0 < 1 - eps) stab0 = 'stable';
    else if (absD0 > 1 + eps) stab0 = 'unstable';

    pts.push({
      x: 0,
      derivative: d0,
      absDerivative: absD0,
      stability: stab0,
      label: 'x* = 0'
    });

    // Fixed point 2: x* = (r - 1) / r, valid in (0, 1] for r > 1
    if (r > 1 + eps) {
      const xStar = (r - 1) / r;
      if (xStar >= 0 && xStar <= 1) {
        const d1 = derivative(r, xStar); // mathematically equals 2 - r
        const absD1 = Math.abs(d1);
        let stab1 = 'neutral';
        if (absD1 < 1 - eps) stab1 = 'stable';
        else if (absD1 > 1 + eps) stab1 = 'unstable';

        pts.push({
          x: xStar,
          derivative: d1,
          absDerivative: absD1,
          stability: stab1,
          label: 'x* = (r-1)/r'
        });
      }
    }

    return pts;
  }

  /**
   * Calculate stability string for a specific point
   */
  function stability(r, x) {
    const absD = Math.abs(derivative(r, x));
    if (absD < 1 - 1e-9) return 'stable';
    if (absD > 1 + 1e-9) return 'unstable';
    return 'neutral';
  }

  /**
   * Calculate the Lyapunov exponent:
   * lambda = lim_{M -> inf} (1/M) * sum_{i=0}^{M-1} ln |f'(x_i)|
   * Discards transient iterations to evaluate the attractor.
   * @param {number} r
   * @param {number} x0
   * @param {number} totalSteps
   * @param {number} transientSteps
   * @returns {number}
   */
  function lyapunovExponent(r, x0, totalSteps = 400, transientSteps = 80) {
    if (r === 0) return -Infinity;
    let x = Math.max(1e-10, Math.min(1 - 1e-10, x0));
    
    // Discard transients
    for (let i = 0; i < transientSteps; i++) {
      x = r * x * (1 - x);
      if (x <= 0 || x >= 1) return -Infinity;
    }

    let sum = 0;
    let validSamples = 0;
    const evalSteps = totalSteps - transientSteps;

    for (let i = 0; i < evalSteps; i++) {
      x = r * x * (1 - x);
      const df = Math.abs(r * (1 - 2 * x));
      if (df < 1e-12) {
        sum += Math.log(1e-12);
      } else {
        sum += Math.log(df);
      }
      validSamples++;
    }

    return validSamples > 0 ? sum / validSamples : 0;
  }

  /**
   * Detect period of attractor from trajectory tail
   * @param {Float64Array|Array<number>} seq
   * @returns {{ period: number, isPeriodic: boolean, distinctValues: number[] }}
   */
  function detectPeriodicity(seq) {
    const n = seq.length;
    if (n < 30) return { period: 0, isPeriodic: false, distinctValues: [] };

    // Examine the last 40 values
    const tailSize = Math.min(64, Math.floor(n / 2));
    const tail = seq.slice(n - tailSize);
    const lastVal = tail[tail.length - 1];
    const tol = 1e-4;

    for (let p = 1; p <= 16; p++) {
      let isCandidate = true;
      for (let i = tail.length - 1 - p; i >= 0; i -= p) {
        if (Math.abs(tail[i] - lastVal) > tol) {
          isCandidate = false;
          break;
        }
      }
      if (isCandidate) {
        // Double check all offsets
        let perfect = true;
        for (let offset = 0; offset < p; offset++) {
          const base = tail[tail.length - 1 - offset];
          for (let k = tail.length - 1 - offset; k >= 0; k -= p) {
            if (Math.abs(tail[k] - base) > tol) {
              perfect = false;
              break;
            }
          }
          if (!perfect) break;
        }
        if (perfect) {
          const vals = [];
          for (let j = 0; j < p; j++) {
            vals.push(tail[tail.length - 1 - (p - 1 - j)]);
          }
          return { period: p, isPeriodic: true, distinctValues: vals };
        }
      }
    }

    return { period: 0, isPeriodic: false, distinctValues: [] };
  }

  /**
   * Scientifically classify dynamical behavior
   * @param {number} r
   * @param {number} x0
   * @param {Float64Array|Array<number>} seq
   * @returns {{ classification: string, detail: string, color: string, badge: string, lyapunov: number }}
   */
  function classifyBehavior(r, x0, seq) {
    const lyap = lyapunovExponent(r, x0);
    const periodic = detectPeriodicity(seq);

    if (r <= 1.0) {
      return {
        classification: 'Decay to Zero',
        detail: 'Population extincts; x* = 0 is a globally attracting fixed point with |f\'(0)| ≤ 1.',
        color: '#69d6a4',
        badge: 'STABLE ATTRACTOR',
        lyapunov: lyap
      };
    }

    if (r <= 3.0) {
      return {
        classification: 'Stable Fixed Point',
        detail: `Monotonic or oscillatory convergence to x* = (r-1)/r = ${((r - 1) / r).toFixed(4)} (|f\'(x*)| < 1).`,
        color: '#55d6e8',
        badge: 'EQUILIBRIUM',
        lyapunov: lyap
      };
    }

    if (r <= 3.44949) {
      return {
        classification: 'Period-2 Cycle',
        detail: 'First period-doubling bifurcation (flip bifurcation); stable 2-cycle alternating state.',
        color: '#f3bd58',
        badge: 'PERIODIC (P = 2)',
        lyapunov: lyap
      };
    }

    if (r <= 3.54409) {
      return {
        classification: 'Period-4 Cycle',
        detail: 'Second period-doubling bifurcation; stable 4-cycle orbit.',
        color: '#f39c12',
        badge: 'PERIODIC (P = 4)',
        lyapunov: lyap
      };
    }

    if (r < 3.569946) {
      return {
        classification: 'Period-Doubling Cascade',
        detail: 'Successive bifurcations (Period 8, 16, 32...) governed by the Feigenbaum ratio δ ≈ 4.6692.',
        color: '#ed83c5',
        badge: 'CASCADE',
        lyapunov: lyap
      };
    }

    // Above Feigenbaum accumulation point r_infinity ≈ 3.569946:
    // Check if within a periodic window (e.g., period-3 window at r ~ 3.8284 - 3.8415)
    if (periodic.isPeriodic && periodic.period > 0 && lyap < 0) {
      return {
        classification: `Periodic Window (Period ${periodic.period})`,
        detail: `Stable periodic island within chaotic regime with negative Lyapunov exponent (λ = ${lyap.toFixed(3)}).`,
        color: '#38ef7d',
        badge: `ISLAND (P = ${periodic.period})`,
        lyapunov: lyap
      };
    }

    return {
      classification: 'Deterministic Chaos',
      detail: `Sensitive dependence on initial conditions with positive Lyapunov exponent (λ ≈ +${Math.max(0.001, lyap).toFixed(3)}). Trajectories diverge exponentially.`,
      color: '#ff6b8b',
      badge: 'CHAOTIC',
      lyapunov: lyap
    };
  }

  /**
   * Generate comparison data: Trajectory A and Trajectory B with small perturbation delta
   * @param {number} r
   * @param {number} x0
   * @param {number} n
   * @param {number} delta Perturbation (e.g. 0.0001)
   * @returns {{ seqA: Float64Array, seqB: Float64Array, diff: Float64Array, x0A: number, x0B: number, maxDiff: number, finalDiff: number, divergenceStep: number }}
   */
  function compareTrajectories(r, x0, n, delta = 0.0001) {
    const x0A = Math.max(0, Math.min(1, x0));
    // Perturb x0 within [0, 1]
    let x0B = x0A + delta;
    if (x0B > 1) x0B = x0A - delta;
    if (x0B < 0) x0B = 0;

    const seqA = iterate(r, x0A, n);
    const seqB = iterate(r, x0B, n);
    const count = seqA.length;
    const diff = new Float64Array(count);

    let maxDiff = 0;
    let divergenceStep = -1;
    const divergenceThreshold = 0.1; // 10% separation

    for (let i = 0; i < count; i++) {
      const d = Math.abs(seqB[i] - seqA[i]);
      diff[i] = d;
      if (d > maxDiff) maxDiff = d;
      if (divergenceStep === -1 && d >= divergenceThreshold) {
        divergenceStep = i;
      }
    }

    return {
      seqA,
      seqB,
      diff,
      x0A,
      x0B,
      initialDiff: Math.abs(x0B - x0A),
      maxDiff,
      finalDiff: diff[count - 1],
      divergenceStep
    };
  }

  const ChaosMath = {
    logistic,
    derivative,
    iterate,
    fixedPoints,
    stability,
    lyapunovExponent,
    detectPeriodicity,
    classifyBehavior,
    compareTrajectories
  };

  root.ChaosMath = ChaosMath;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChaosMath;
  }
})(typeof window !== 'undefined' ? window : globalThis);
