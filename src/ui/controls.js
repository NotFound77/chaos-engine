/**
 * CHAOS ENGINE — Physical Controller UI & Parameter Synchronizer
 * Bridges physical knobs/buttons with web sliders and state.
 */

(function (root) {
  'use strict';

  class ControlPanel {
    constructor(app) {
      this.app = app;

      // DOM Elements
      this.rSlider = document.getElementById('r-slider');
      this.x0Slider = document.getElementById('x0-slider');
      this.nSlider = document.getElementById('n-slider');

      this.rVal = document.getElementById('r-val');
      this.x0Val = document.getElementById('x0-val');
      this.nVal = document.getElementById('n-val');

      this.knobR = document.getElementById('knob-r-needle');
      this.knobX0 = document.getElementById('knob-x0-needle');
      this.knobN = document.getElementById('knob-n-dial');

      this.btnStart = document.getElementById('btn-start');
      this.btnReset = document.getElementById('btn-reset');
      this.btnCompare = document.getElementById('btn-compare');
      this.btnConnect = document.getElementById('btn-connect-serial');

      this.deltaSelect = document.getElementById('delta-select');
      this.presetButtons = document.querySelectorAll('[data-preset]');

      this.bindEvents();
    }

    bindEvents() {
      // Sliders input (Simulation mode or manual adjustment)
      if (this.rSlider) {
        this.rSlider.addEventListener('input', (e) => {
          this.app.setParameter('r', parseFloat(e.target.value), 'slider');
        });
      }

      if (this.x0Slider) {
        this.x0Slider.addEventListener('input', (e) => {
          this.app.setParameter('x0', parseFloat(e.target.value), 'slider');
        });
      }

      if (this.nSlider) {
        this.nSlider.addEventListener('input', (e) => {
          this.app.setParameter('n', parseInt(e.target.value, 10), 'slider');
        });
      }

      // Buttons
      if (this.btnStart) {
        this.btnStart.addEventListener('click', () => {
          this.app.toggleRunning();
        });
      }

      if (this.btnReset) {
        this.btnReset.addEventListener('click', () => {
          this.app.resetExperiment();
        });
      }

      if (this.btnCompare) {
        this.btnCompare.addEventListener('click', () => {
          this.app.toggleCompare();
        });
      }

      if (this.btnConnect) {
        this.btnConnect.addEventListener('click', () => {
          this.app.toggleSerialConnection();
        });
      }

      // Perturbation change
      if (this.deltaSelect) {
        this.deltaSelect.addEventListener('change', (e) => {
          this.app.setPerturbation(parseFloat(e.target.value));
        });
      }

      // Presets
      this.presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const r = parseFloat(btn.dataset.r);
          const x0 = parseFloat(btn.dataset.x);
          const name = btn.dataset.preset;
          this.app.applyPreset(name, r, x0);
        });
      });
    }

    /**
     * Update visual indicators (knob needles, displays, sliders)
     */
    updateValues(r, x0, n, source = 'system') {
      if (this.rVal) this.rVal.textContent = Number(r).toFixed(3);
      if (this.x0Val) this.x0Val.textContent = Number(x0).toFixed(4);
      if (this.nVal) this.nVal.textContent = Math.round(n);

      if (this.rSlider && source !== 'slider') this.rSlider.value = r;
      if (this.x0Slider && source !== 'slider') this.x0Slider.value = x0;
      if (this.nSlider && source !== 'slider') this.nSlider.value = n;

      // Rotate visual knob needles (-135deg to +135deg = 270deg sweep)
      if (this.knobR) {
        const angleR = -135 + (r / 4) * 270;
        this.knobR.style.transform = `rotate(${angleR}deg)`;
      }

      if (this.knobX0) {
        const angleX0 = -135 + x0 * 270;
        this.knobX0.style.transform = `rotate(${angleX0}deg)`;
      }

      if (this.knobN) {
        // Rotary encoder continuous step feel: 360 deg sweep mod
        const angleN = ((n - 5) / 495) * 360;
        this.knobN.style.transform = `rotate(${angleN}deg)`;
      }
    }

    /**
     * Update state of buttons (e.g. START glowing when running)
     */
    updateButtonStates(isRunning, isComparing) {
      if (this.btnStart) {
        if (isRunning) {
          this.btnStart.classList.add('active', 'btn-running');
          this.btnStart.innerHTML = '<span class="btn-icon">⏸</span> PAUSE EXPERIMENT';
        } else {
          this.btnStart.classList.remove('active', 'btn-running');
          this.btnStart.innerHTML = '<span class="btn-icon">▶</span> START EXPERIMENT';
        }
      }

      if (this.btnCompare) {
        if (isComparing) {
          this.btnCompare.classList.add('active', 'btn-comparing');
          this.btnCompare.innerHTML = '<span class="btn-icon">⚖</span> COMPARISON: ON';
        } else {
          this.btnCompare.classList.remove('active', 'btn-comparing');
          this.btnCompare.innerHTML = '<span class="btn-icon">⚖</span> COMPARE (OFF)';
        }
      }
    }

    highlightPreset(presetName) {
      this.presetButtons.forEach(btn => {
        if (btn.dataset.preset === presetName) {
          btn.classList.add('preset-active');
        } else {
          btn.classList.remove('preset-active');
        }
      });
    }
  }

  root.ControlPanel = ControlPanel;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ControlPanel;
  }
})(typeof window !== 'undefined' ? window : globalThis);
