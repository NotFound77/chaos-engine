/**
 * CHAOS ENGINE — Bifurcation Diagram: Long-Term Attractor vs r
 * High-performance buffered canvas rendering with interactive cursor & coordinate inspection.
 */

(function (root) {
  'use strict';

  class BifurcationChart {
    constructor(canvasId, coordDisplayId) {
      this.coordEl = document.getElementById(coordDisplayId);
      this.base = new root.ChartBase(canvasId, {
        defaultDomain: { xmin: 0, xmax: 4, ymin: 0, ymax: 1 },
        labels: ['Growth Parameter (r)', 'Long-Term State Value x*'],
        onSelect: (pt) => this.updateCoord(pt)
      });

      this.currentR = 2.0;
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
      this.cacheDirty = true;
      this.cachedView = null;

      this.base.renderCallback = () => {
        this.cacheDirty = true;
        this.draw();
      };
    }

    setR(r) {
      this.currentR = r;
      this.draw();
    }

    updateCoord(pt) {
      if (!this.coordEl) return;
      if (!pt) {
        this.coordEl.innerHTML = '<span class="coord-placeholder">Selected point: none — click any point on the diagram to inspect (r, x).</span>';
        return;
      }
      const rStr = `r = ${Number(pt.x).toFixed(5)}`;
      const xStr = `x* = ${Number(pt.y).toFixed(6)}`;
      this.coordEl.innerHTML = `<strong>Selected Point:</strong> <span class="coord-val">${rStr}</span> &nbsp;|&nbsp; <span class="coord-val">${xStr}</span>`;
    }

    resetZoom() {
      this.base.resetZoom();
      this.cacheDirty = true;
      this.draw();
    }

    /**
     * Compute and render the bifurcation points to the offscreen buffer
     */
    updateOffscreenBuffer() {
      const plot = this.base.plot;
      const w = Math.max(1, Math.round(plot.width * this.base.dpr));
      const h = Math.max(1, Math.round(plot.height * this.base.dpr));

      if (this.offscreenCanvas.width !== w || this.offscreenCanvas.height !== h) {
        this.offscreenCanvas.width = w;
        this.offscreenCanvas.height = h;
      }

      const oCtx = this.offscreenCtx;
      oCtx.clearRect(0, 0, w, h);

      const view = this.base.view;
      const rMin = Math.max(0, view.xmin);
      const rMax = Math.min(4, view.xmax);
      if (rMax <= rMin) return;

      // Sample count based on plot width
      const numRSteps = Math.min(800, Math.max(200, Math.round(plot.width)));
      const transientSteps = 250;
      const sampleSteps = 80;

      const pts = [];
      oCtx.fillStyle = 'rgba(0, 229, 255, 0.45)';

      const toOffX = (r) => ((r - view.xmin) / (view.xmax - view.xmin)) * w;
      const toOffY = (x) => ((view.ymax - x) / (view.ymax - view.ymin)) * h;

      for (let i = 0; i < numRSteps; i++) {
        const r = rMin + (i / numRSteps) * (rMax - rMin);
        let x = 0.3541; // Non-trivial initial seed

        // Transient phase: let system settle onto the attractor
        for (let t = 0; t < transientSteps; t++) {
          x = r * x * (1 - x);
        }

        // Sampling phase: record points on the attractor
        const sx = toOffX(r);
        for (let s = 0; s < sampleSteps; s++) {
          x = r * x * (1 - x);
          if (x >= view.ymin && x <= view.ymax) {
            const sy = toOffY(x);
            oCtx.fillRect(sx, sy, 1.2, 1.2);

            // Store representative points for hit testing
            if (s % 8 === 0 && pts.length < 5000) {
              pts.push({ x: r, y: x });
            }
          }
        }
      }

      this.base.points = pts;
      this.cacheDirty = false;
      this.cachedView = { ...view };
    }

    draw() {
      this.base.resize();
      this.base.drawGrid();

      // Check if buffer needs regeneration
      if (this.cacheDirty || !this.cachedView ||
          this.cachedView.xmin !== this.base.view.xmin ||
          this.cachedView.xmax !== this.base.view.xmax ||
          this.cachedView.ymin !== this.base.view.ymin ||
          this.cachedView.ymax !== this.base.view.ymax) {
        this.updateOffscreenBuffer();
      }

      const ctx = this.base.ctx;
      const plot = this.base.plot;

      ctx.save();
      ctx.setTransform(this.base.dpr, 0, 0, this.base.dpr, 0, 0);

      // Clip inside plot area
      ctx.save();
      ctx.beginPath();
      ctx.rect(plot.left, plot.top, plot.width, plot.height);
      ctx.clip();

      // Blit offscreen buffer onto visible canvas
      ctx.drawImage(this.offscreenCanvas, plot.left, plot.top, plot.width, plot.height);

      // Draw vertical indicator for currently selected r
      const curX = this.base.toScreenX(this.currentR);
      if (curX >= plot.left && curX <= plot.left + plot.width) {
        ctx.strokeStyle = '#ffab00';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.shadowColor = 'rgba(255, 171, 0, 0.6)';
        ctx.shadowBlur = 6;

        ctx.beginPath();
        ctx.moveTo(curX, plot.top);
        ctx.lineTo(curX, plot.top + plot.height);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Label flag at top
        ctx.fillStyle = '#ffab00';
        ctx.fillRect(curX - 28, plot.top + 4, 56, 18);
        ctx.fillStyle = '#080d1a';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`r=${this.currentR.toFixed(3)}`, curX, plot.top + 17);
      }

      ctx.restore(); // end clip

      // Highlight selected point if any
      this.base.drawSelectedHighlight('#ffb300');

      ctx.restore();
    }
  }

  root.BifurcationChart = BifurcationChart;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BifurcationChart;
  }
})(typeof window !== 'undefined' ? window : globalThis);
