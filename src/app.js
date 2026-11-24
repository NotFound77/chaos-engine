/**
 * CHAOS ENGINE — Master Application Controller
 * Orchestrates mathematics, real-time serial hardware, charts, and interactive UI.
 */

(function (root) {
  'use strict';

  class ChaosEngineApp {
    constructor() {
      // Core Parameters
      this.r = 0.94;
      this.x0 = 0.46;
      this.n = 90;

      // Experiment State
      this.isRunning = false;
      this.isComparing = false;
      this.perturbationDelta = 0.0001;
      this.activePreset = null;
      this.animStep = null; // null = show full sequence, number = show up to step
      this.animTimer = null;

      // Rate limiting for hardware updates
      this.pendingUpdate = false;
      this.lastSerialUpdate = 0;

      // Sound feedback (Web Audio API synthetic click/tone)
      this.audioCtx = null;
    }

    init() {
      console.log('⚡ Initializing CHAOS ENGINE...');

      // 1. Initialize UI Controls & Status Displays
      this.controls = new root.ControlPanel(this);
      this.statusDisplay = new root.StatusDisplay();

      // 2. Initialize Charts
      this.charts = {
        iteration: new root.IterationChart('canvas-iteration', 'coord-iteration'),
        cobweb: new root.CobwebChart('canvas-cobweb', 'coord-cobweb'),
        bifurcation: new root.BifurcationChart('canvas-bifurcation', 'coord-bifurcation'),
        comparison: new root.ComparisonChart('canvas-comparison', 'coord-comparison')
      };

      // 3. Connect Reset Zoom Buttons
      document.querySelectorAll('[data-reset-chart]').forEach(btn => {
        btn.addEventListener('click', () => {
          const chartName = btn.dataset.resetChart;
          if (this.charts[chartName]) {
            this.charts[chartName].resetZoom();
          }
        });
      });

      // 4. Setup Serial Hardware Hooks
      this.initSerial();

      // 5. Setup Window Resize handler
      window.addEventListener('resize', () => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this.recalculate(true), 120);
      });

      // 6. Perform initial calculation
      this.statusDisplay.updateHardwareStatus(false, 'SIMULATION_MODE', 'Ready. Operating in Simulation Mode.');
      this.statusDisplay.updateExperimentStatus('READY');
      this.recalculate(true);
    }

    /**
     * Set up Web Serial Manager listeners
     */
    initSerial() {
      const serial = root.ChaosSerial;
      if (!serial) return;

      serial.on('status', ({ connected, mode, message }) => {
        this.statusDisplay.updateHardwareStatus(connected, mode, message);
        const connectBtn = document.getElementById('btn-connect-serial');
        if (connectBtn) {
          if (connected) {
            connectBtn.classList.add('connected');
            connectBtn.innerHTML = '<span class="btn-icon">⚡</span> DISCONNECT ARDUINO';
          } else {
            connectBtn.classList.remove('connected');
            connectBtn.innerHTML = '<span class="btn-icon">🔌</span> CONNECT ARDUINO';
          }
        }
      });

      serial.on('param', ({ r, x0, n }) => {
        this.setParameters(r, x0, n, 'hardware');
      });

      serial.on('event', (eventName) => {
        console.log(`[Hardware Event Received]: ${eventName}`);
        switch (eventName) {
          case 'START':
            this.toggleRunning();
            break;
          case 'RESET':
            this.resetExperiment();
            break;
          case 'COMPARE':
            this.toggleCompare();
            break;
          case 'ENCODER_PRESS':
            this.cyclePresets();
            break;
          default:
            break;
        }
      });

      serial.on('error', (err) => {
        console.warn('Serial Hardware Error:', err);
      });
    }

    async toggleSerialConnection() {
      const serial = root.ChaosSerial;
      if (!serial) return;

      if (serial.isConnected) {
        await serial.disconnect();
      } else {
        try {
          await serial.connect();
        } catch (err) {
          // Handled in serial manager
        }
      }
    }

    /**
     * Parameter setter with throttling for 60Hz serial telemetry
     */
    setParameter(param, value, source = 'system') {
      if (param === 'r') this.r = Math.max(0, Math.min(4, value));
      if (param === 'x0') this.x0 = Math.max(0, Math.min(1, value));
      if (param === 'n') this.n = Math.max(5, Math.min(500, Math.round(value)));

      this.activePreset = null;
      this.controls.highlightPreset(null);

      this.scheduleUpdate(source);
    }

    setParameters(r, x0, n, source = 'hardware') {
      this.r = Math.max(0, Math.min(4, r));
      this.x0 = Math.max(0, Math.min(1, x0));
      this.n = Math.max(5, Math.min(500, Math.round(n)));

      this.scheduleUpdate(source);
    }

    setPerturbation(delta) {
      this.perturbationDelta = delta;
      if (this.isComparing) {
        this.recalculate(false);
      }
    }

    scheduleUpdate(source) {
      if (this.pendingUpdate) return;
      this.pendingUpdate = true;

      requestAnimationFrame(() => {
        this.pendingUpdate = false;
        this.controls.updateValues(this.r, this.x0, this.n, source);
        this.recalculate(false);
      });
    }

    /**
     * Master recalculation & chart redraw
     */
    recalculate(full = false) {
      const MathCore = root.ChaosMath;
      if (!MathCore) return;

      // 1. Calculate trajectory
      const seq = MathCore.iterate(this.r, this.x0, this.n);

      // 2. Calculate fixed points & stability
      const fixedPts = MathCore.fixedPoints(this.r);

      // 3. Classify behavior & Lyapunov exponent
      const behavior = MathCore.classifyBehavior(this.r, this.x0, seq);

      // 4. Update status & telemetry UI
      this.statusDisplay.updateMetrics(this.r, this.x0, this.n, seq, behavior, fixedPts);

      // 5. Update Iteration & Cobweb charts
      const visibleStep = this.isRunning ? this.animStep : null;
      this.charts.iteration.setData(seq, visibleStep);
      this.charts.cobweb.setData(this.r, seq, visibleStep);

      // 6. Update Bifurcation diagram
      this.charts.bifurcation.setR(this.r);

      // 7. Update Comparison chart if active
      if (this.isComparing) {
        const compData = MathCore.compareTrajectories(this.r, this.x0, this.n, this.perturbationDelta);
        this.charts.comparison.setData(compData, visibleStep);
        this.updateComparisonSummary(compData);
      }
    }

    updateComparisonSummary(compData) {
      const summaryEl = document.getElementById('comparison-summary');
      if (!summaryEl) return;

      const divStr = compData.divergenceStep !== -1
        ? `<span class="badge-alert">Diverged at Iteration n = ${compData.divergenceStep}</span>`
        : '<span class="badge-stable">No significant divergence observed within N iterations</span>';

      summaryEl.innerHTML = `
        <div class="comp-stat-grid">
          <div class="comp-stat">
            <span class="stat-label">Initial Perturbation Δx₀</span>
            <span class="stat-val">${compData.initialDiff.toExponential(4)}</span>
          </div>
          <div class="comp-stat">
            <span class="stat-label">Final Separation |Δx(N)|</span>
            <span class="stat-val">${compData.finalDiff.toFixed(6)}</span>
          </div>
          <div class="comp-stat">
            <span class="stat-label">Maximum Separation</span>
            <span class="stat-val">${compData.maxDiff.toFixed(6)}</span>
          </div>
          <div class="comp-stat">
            <span class="stat-label">Divergence Status</span>
            <span class="stat-val">${divStr}</span>
          </div>
        </div>
      `;
    }

    /**
     * Start / Pause execution
     */
    toggleRunning() {
      this.isRunning = !this.isRunning;
      this.controls.updateButtonStates(this.isRunning, this.isComparing);
      this.statusDisplay.updateExperimentStatus(this.isRunning ? 'RUNNING' : 'PAUSED');

      if (this.isRunning) {
        this.startAnimation();
      } else {
        this.stopAnimation();
      }
    }

    startAnimation() {
      this.stopAnimation();
      if (this.animStep === null || this.animStep >= this.n) {
        this.animStep = 1;
      }

      const animate = () => {
        if (!this.isRunning) return;

        this.animStep++;
        if (this.animStep > this.n) {
          // Pause when reached end of sequence
          this.isRunning = false;
          this.controls.updateButtonStates(false, this.isComparing);
          this.statusDisplay.updateExperimentStatus('READY');
          this.animStep = null;
          this.recalculate(false);
          return;
        }

        this.recalculate(false);
        this.animTimer = setTimeout(animate, 25); // ~40 steps per second
      };

      this.animTimer = setTimeout(animate, 25);
    }

    stopAnimation() {
      if (this.animTimer) {
        clearTimeout(this.animTimer);
        this.animTimer = null;
      }
    }

    /**
     * Reset experiment to canonical initial conditions
     */
    resetExperiment() {
      this.stopAnimation();
      this.isRunning = false;
      this.animStep = null;

      this.r = 0.94;
      this.x0 = 0.46;
      this.n = 90;
      this.activePreset = null;

      this.controls.updateValues(this.r, this.x0, this.n, 'system');
      this.controls.updateButtonStates(false, this.isComparing);
      this.controls.highlightPreset(null);
      this.statusDisplay.updateExperimentStatus('READY');

      // Reset chart views
      Object.values(this.charts).forEach(c => c.resetZoom());

      this.recalculate(true);
    }

    /**
     * Toggle comparison mode
     */
    toggleCompare() {
      this.isComparing = !this.isComparing;
      this.controls.updateButtonStates(this.isRunning, this.isComparing);

      const compCard = document.getElementById('card-comparison');
      if (compCard) {
        compCard.style.display = this.isComparing ? 'block' : 'none';
        if (this.isComparing && typeof compCard.scrollIntoView === 'function') {
          compCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      this.recalculate(true);
    }

    /**
     * Presets
     */
    applyPreset(name, r, x0) {
      this.r = r;
      this.x0 = x0;
      this.activePreset = name;

      this.controls.updateValues(this.r, this.x0, this.n, 'system');
      this.controls.highlightPreset(name);
      this.recalculate(false);
    }

    cyclePresets() {
      const presets = [
        { name: 'Decay', r: 0.5, x0: 0.2 },
        { name: 'Stable', r: 2.0, x0: 0.2 },
        { name: 'Period 2', r: 3.2, x0: 0.2 },
        { name: 'Period 4', r: 3.5, x0: 0.2 },
        { name: 'Chaotic', r: 3.9, x0: 0.2 }
      ];

      const currentIdx = presets.findIndex(p => p.name === this.activePreset);
      const nextIdx = (currentIdx + 1) % presets.length;
      const next = presets[nextIdx];
      this.applyPreset(next.name, next.r, next.x0);
    }
  }

  root.ChaosEngineApp = ChaosEngineApp;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChaosEngineApp;
  }

  // Auto-boot when DOM is ready
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('DOMContentLoaded', () => {
      const app = new ChaosEngineApp();
      root.ChaosEngineAppInstance = app;
      app.init();
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);
