/**
 * CHAOS ENGINE — Cobweb Diagram: x(n+1) vs x(n)
 * Visualises iterative convergence, limit cycles, and strange attractors.
 */

(function (root) {
  'use strict';

  class CobwebChart {
    constructor(canvasId, coordDisplayId) {
      this.coordEl = document.getElementById(coordDisplayId);
      this.base = new root.ChartBase(canvasId, {
        defaultDomain: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
        labels: ['Current State x(n)', 'Next State x(n+1)'],
        onSelect: (pt) => this.updateCoord(pt)
      });

      this.base.renderCallback = () => this.draw();
      this.r = 2.0;
      this.sequence = [];
      this.visibleSteps = null;
    }

    setData(r, seq, visibleSteps = null) {
      this.r = r;
      this.sequence = seq;
      this.visibleSteps = visibleSteps;
      this.draw();
    }

    updateCoord(pt) {
      if (!this.coordEl) return;
      if (!pt) {
        this.coordEl.innerHTML = '<span class="coord-placeholder">Selected point: none — click any point on the cobweb path or curve.</span>';
        return;
      }
      const xStr = `x(n) = ${Number(pt.x).toFixed(8)}`;
      const yStr = `x(n+1) = ${Number(pt.y).toFixed(8)}`;
      const meta = pt.step !== undefined ? `[Step ${pt.step}] ` : '';
      this.coordEl.innerHTML = `<strong>Selected Point:</strong> ${meta}<span class="coord-val">${xStr}</span> &nbsp;|&nbsp; <span class="coord-val">${yStr}</span>`;
    }

    resetZoom() {
      this.base.resetZoom();
    }

    draw() {
      this.base.resize();
      this.base.drawGrid();

      const ctx = this.base.ctx;
      const r = this.r;
      const seq = this.sequence;

      ctx.save();
      ctx.setTransform(this.base.dpr, 0, 0, this.base.dpr, 0, 0);

      // Clip inside plot area
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.base.plot.left, this.base.plot.top, this.base.plot.width, this.base.plot.height);
      ctx.clip();

      // 1. Identity Line y = x
      ctx.strokeStyle = '#ffc400';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.base.toScreenX(0), this.base.toScreenY(0));
      ctx.lineTo(this.base.toScreenX(1), this.base.toScreenY(1));
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Logistic Curve f(x) = r * x * (1 - x)
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(0, 229, 255, 0.4)';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      const curveSamples = 200;
      for (let i = 0; i <= curveSamples; i++) {
        const x = i / curveSamples;
        const y = r * x * (1 - x);
        const sx = this.base.toScreenX(x);
        const sy = this.base.toScreenY(y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Cobweb Trajectory
      const points = [];
      if (seq && seq.length > 1) {
        const maxIdx = this.visibleSteps !== null ? Math.min(seq.length - 1, this.visibleSteps) : seq.length - 1;

        ctx.strokeStyle = '#ff4081';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(255, 64, 129, 0.4)';
        ctx.shadowBlur = 4;

        ctx.beginPath();
        let curr = seq[0];
        // Start on horizontal axis: (x0, 0)
        let sx = this.base.toScreenX(curr);
        let sy = this.base.toScreenY(0);
        ctx.moveTo(sx, sy);

        for (let i = 1; i <= maxIdx; i++) {
          const next = seq[i];
          // Vertical segment: from (x_{i-1}, x_{i-1}) [or (x0,0)] to (x_{i-1}, x_i) on curve
          const syCurve = this.base.toScreenY(next);
          ctx.lineTo(sx, syCurve);

          points.push({ x: curr, y: next, step: i, type: 'curve' });

          // Horizontal segment: from (x_{i-1}, x_i) to (x_i, x_i) on diagonal
          const sxDiag = this.base.toScreenX(next);
          ctx.lineTo(sxDiag, syCurve);

          points.push({ x: next, y: next, step: i, type: 'diagonal' });

          curr = next;
          sx = sxDiag;
          sy = syCurve;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Highlight initial condition x0
        const x0ScreenX = this.base.toScreenX(seq[0]);
        const x0ScreenY = this.base.toScreenY(0);
        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(x0ScreenX, x0ScreenY, 5, 0, Math.PI * 2);
        ctx.fill();

        // Highlight current state
        if (maxIdx > 0) {
          ctx.fillStyle = '#ff4081';
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Mark theoretical fixed points if r > 1
      if (r > 1) {
        const xStar = (r - 1) / r;
        const fxX = this.base.toScreenX(xStar);
        const fxY = this.base.toScreenY(xStar);

        ctx.strokeStyle = '#38ef7d';
        ctx.lineWidth = 2;
        ctx.strokeRect(fxX - 4, fxY - 4, 8, 8);
      }

      this.base.points = points;
      ctx.restore(); // end clip

      // Highlight selected point
      this.base.drawSelectedHighlight('#ffb300');

      ctx.restore();
    }
  }

  root.CobwebChart = CobwebChart;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CobwebChart;
  }
})(typeof window !== 'undefined' ? window : globalThis);
