/**
 * CHAOS ENGINE — Live Telemetry & Status Displays
 * Manages scientific metrics, fixed-point stability readouts, and hardware badges.
 */

(function (root) {
  'use strict';

  class StatusDisplay {
    constructor() {
      this.currentValEl = document.getElementById('metric-current');
      this.fixedPointsEl = document.getElementById('metric-fixed');
      this.behaviourEl = document.getElementById('metric-behaviour');
      this.lyapunovEl = document.getElementById('metric-lyapunov');

      this.stabilityDetailsEl = document.getElementById('stability-details');
      this.stabilityFormulaEl = document.getElementById('stability-formula');

      this.hwStatusBadgeEl = document.getElementById('hw-status-badge');
      this.hwStatusMsgEl = document.getElementById('hw-status-msg');
      this.expStatusBadgeEl = document.getElementById('exp-status-badge');

      this.sequenceListEl = document.getElementById('sequence-list');
      this.btnCopySeq = document.getElementById('btn-copy-seq');

      if (this.btnCopySeq) {
        this.btnCopySeq.addEventListener('click', () => this.copySequence());
      }

      this.currentSequence = [];
    }

    updateHardwareStatus(connected, mode, message) {
      if (this.hwStatusBadgeEl) {
        this.hwStatusBadgeEl.className = 'status-pill';
        if (connected) {
          this.hwStatusBadgeEl.classList.add('pill-online');
          this.hwStatusBadgeEl.innerHTML = '<span class="pill-dot"></span> HARDWARE CONNECTED';
        } else if (mode === 'SIMULATION_MODE') {
          this.hwStatusBadgeEl.classList.add('pill-simulation');
          this.hwStatusBadgeEl.innerHTML = '<span class="pill-dot"></span> SIMULATION MODE';
        } else {
          this.hwStatusBadgeEl.classList.add('pill-offline');
          this.hwStatusBadgeEl.innerHTML = '<span class="pill-dot"></span> HARDWARE DISCONNECTED';
        }
      }

      if (this.hwStatusMsgEl) {
        this.hwStatusMsgEl.textContent = message || '';
        if (message && (message.includes('busy') || message.includes('Serial Monitor') || message.includes('locked'))) {
          this.hwStatusMsgEl.style.color = '#ffab00';
          this.hwStatusMsgEl.style.fontWeight = 'bold';
        } else {
          this.hwStatusMsgEl.style.color = connected ? '#00e676' : '';
          this.hwStatusMsgEl.style.fontWeight = 'normal';
        }
      }
    }

    updateExperimentStatus(state) {
      if (this.expStatusBadgeEl) {
        this.expStatusBadgeEl.className = 'status-pill';
        if (state === 'RUNNING') {
          this.expStatusBadgeEl.classList.add('pill-running');
          this.expStatusBadgeEl.innerHTML = '<span class="pill-dot pulse"></span> RUNNING';
        } else if (state === 'PAUSED') {
          this.expStatusBadgeEl.classList.add('pill-paused');
          this.expStatusBadgeEl.innerHTML = '<span class="pill-dot"></span> PAUSED';
        } else {
          this.expStatusBadgeEl.classList.add('pill-ready');
          this.expStatusBadgeEl.innerHTML = '<span class="pill-dot"></span> READY';
        }
      }
    }

    updateMetrics(r, x0, n, seq, behavior, fixedPts) {
      this.currentSequence = seq;
      const count = seq.length;
      const lastVal = count > 0 ? seq[count - 1] : 0;

      // Metric 1: Current Iteration Value
      if (this.currentValEl) {
        this.currentValEl.textContent = Number(lastVal).toFixed(8);
      }

      // Metric 2: Fixed Points
      if (this.fixedPointsEl) {
        const fpStrings = fixedPts.map(p => `${p.label} = ${Number(p.x).toFixed(5)}`);
        this.fixedPointsEl.textContent = fpStrings.join('  |  ');
      }

      // Metric 3: Observed Dynamical Behaviour
      if (this.behaviourEl) {
        this.behaviourEl.textContent = behavior.classification;
        this.behaviourEl.style.color = behavior.color;
      }

      // Metric 4: Lyapunov Exponent
      if (this.lyapunovEl) {
        const lVal = behavior.lyapunov;
        if (!Number.isFinite(lVal)) {
          this.lyapunovEl.textContent = '-∞ (Extinction)';
          this.lyapunovEl.style.color = '#69d6a4';
        } else {
          const sign = lVal > 0 ? '+' : '';
          this.lyapunovEl.textContent = `${sign}${lVal.toFixed(4)}`;
          this.lyapunovEl.style.color = lVal > 0.05 ? '#ff4081' : lVal < -0.05 ? '#00e5ff' : '#ffc400';
        }
      }

      // Fixed Point Stability Details
      if (this.stabilityDetailsEl) {
        const lines = fixedPts.map(p => {
          const stabColor = p.stability === 'stable' ? '#00e676' : p.stability === 'unstable' ? '#ff5252' : '#ffc400';
          const derivSign = p.derivative >= 0 ? '+' : '';
          return `
            <div class="stability-row">
              <span class="fp-name"><strong>${p.label}</strong> (x* = ${Number(p.x).toFixed(6)}):</span>
              <span class="fp-deriv">f′(x*) = ${derivSign}${Number(p.derivative).toFixed(4)} &rarr; |f′(x*)| = ${Number(p.absDerivative).toFixed(4)}</span>
              <span class="fp-badge" style="background:${stabColor}22; color:${stabColor}; border:1px solid ${stabColor}66;">${p.stability.toUpperCase()}</span>
            </div>
          `;
        });

        this.stabilityDetailsEl.innerHTML = lines.join('');
      }

      if (this.stabilityFormulaEl) {
        this.stabilityFormulaEl.innerHTML = `
          <strong>Condition for Linear Stability:</strong> |f′(x*)| = |r(1 − 2x*)| < 1.<br>
          For x* = 0: |r| < 1 &rarr; stable for 0 &le; r &lt; 1.<br>
          For x* = (r−1)/r: f′(x*) = 2 − r &rarr; |2 − r| &lt; 1 &rarr; stable for 1 &lt; r &lt; 3.
        `;
      }

      // Sequence List chips (First 120 values)
      if (this.sequenceListEl) {
        const displayLimit = Math.min(seq.length, 120);
        const chips = [];
        for (let i = 0; i < displayLimit; i++) {
          chips.push(`<span class="seq-chip"><span class="chip-n">n=${i}</span><span class="chip-val">${Number(seq[i]).toFixed(6)}</span></span>`);
        }
        if (seq.length > displayLimit) {
          chips.push(`<span class="seq-chip seq-more">+ ${seq.length - displayLimit} more iterations calculated...</span>`);
        }
        this.sequenceListEl.innerHTML = chips.join('');
      }
    }

    copySequence() {
      if (!this.currentSequence || !this.currentSequence.length) return;
      const csv = Array.from(this.currentSequence).map((v, i) => `${i},${v.toFixed(10)}`).join('\n');
      navigator.clipboard.writeText(`n,x_n\n${csv}`).then(() => {
        if (this.btnCopySeq) {
          const original = this.btnCopySeq.innerHTML;
          this.btnCopySeq.innerHTML = '✔ COPIED CSV';
          setTimeout(() => { this.btnCopySeq.innerHTML = original; }, 2000);
        }
      }).catch(err => {
        console.warn('Clipboard write failed:', err);
      });
    }
  }

  root.StatusDisplay = StatusDisplay;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatusDisplay;
  }
})(typeof window !== 'undefined' ? window : globalThis);
