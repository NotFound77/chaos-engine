/**
 * CHAOS ENGINE — Iteration Graph: x(n) vs n
 */

(function (root) {
  'use strict';

  class IterationChart {
    constructor(canvasId, coordDisplayId) {
      this.coordEl = document.getElementById(coordDisplayId);
      this.base = new root.ChartBase(canvasId, {
        defaultDomain: { xmin: 0, xmax: 90, ymin: 0, ymax: 1 },
        labels: ['Iteration Number (n)', 'State Value x(n)'],
        onSelect: (pt) => this.updateCoord(pt)
      });

      this.base.renderCallback = () => this.draw();
      this.sequence = [];
      this.visibleSteps = null; // null means all
    }

    setData(seq, visibleSteps = null) {
      this.sequence = seq;
      this.visibleSteps = visibleSteps;
      const count = seq.length;

      // Update default X domain if not zoomed
      if (this.base.view.xmin === this.base.defaultDomain.xmin &&
          this.base.view.xmax === this.base.defaultDomain.xmax) {
        this.base.defaultDomain.xmax = Math.max(10, count - 1);
        this.base.view.xmax = this.base.defaultDomain.xmax;
      }

      this.draw();
    }

    updateCoord(pt) {
      if (!this.coordEl) return;
      if (!pt) {
        this.coordEl.innerHTML = '<span class="coord-placeholder">Selected point: none — click any point to pin coordinates.</span>';
        return;
      }
      const nStr = pt.isArbitrary ? `n ≈ ${pt.x.toFixed(1)}` : `n = ${Math.round(pt.x)}`;
      const xStr = `x(n) = ${Number(pt.y).toFixed(8)}`;
      this.coordEl.innerHTML = `<strong>Selected Point:</strong> <span class="coord-val">${nStr}</span> &nbsp;|&nbsp; <span class="coord-val">${xStr}</span>`;
    }

    resetZoom() {
      this.base.defaultDomain.xmax = Math.max(10, (this.sequence ? this.sequence.length : 90) - 1);
      this.base.resetZoom();
    }

    draw() {
      this.base.resize();
      this.base.drawGrid();

      const ctx = this.base.ctx;
      const seq = this.sequence;
      if (!seq || seq.length === 0) return;

      const maxIdx = this.visibleSteps !== null ? Math.min(seq.length - 1, this.visibleSteps) : seq.length - 1;
      const pts = [];

      for (let i = 0; i <= maxIdx; i++) {
        pts.push({ x: i, y: seq[i] });
      }
      this.base.points = pts;

      ctx.save();
      ctx.setTransform(this.base.dpr, 0, 0, this.base.dpr, 0, 0);

      // Clip to plot boundaries
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.base.plot.left, this.base.plot.top, this.base.plot.width, this.base.plot.height);
      ctx.clip();

      // Trajectory Line
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(0, 229, 255, 0.5)';
      ctx.shadowBlur = 6;

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const sx = this.base.toScreenX(pts[i].x);
        const sy = this.base.toScreenY(pts[i].y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Plot point markers
      // Only draw pips if not too densely packed on screen
      const pxPerPoint = this.base.plot.width / Math.max(1, this.base.view.xmax - this.base.view.xmin);
      const drawPips = pxPerPoint >= 4;

      if (drawPips) {
        ctx.fillStyle = '#ffc400';
        for (let i = 0; i < pts.length; i++) {
          const sx = this.base.toScreenX(pts[i].x);
          const sy = this.base.toScreenY(pts[i].y);
          ctx.beginPath();
          ctx.arc(sx, sy, Math.min(3.5, Math.max(1.5, pxPerPoint * 0.2)), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Highlight the latest/current point with glowing cyan dot
      if (pts.length > 0) {
        const lastPt = pts[pts.length - 1];
        const lx = this.base.toScreenX(lastPt.x);
        const ly = this.base.toScreenY(lastPt.y);
        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore(); // end clip

      // Highlight selected point if any
      this.base.drawSelectedHighlight('#ffb300');

      ctx.restore();
    }
  }

  root.IterationChart = IterationChart;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IterationChart;
  }
})(typeof window !== 'undefined' ? window : globalThis);
