/**
 * CHAOS ENGINE — Comparison Graph & Sensitivity Analysis
 * Demonstrates sensitive dependence on initial conditions (The Butterfly Effect).
 * Plots Trajectory A vs Trajectory B and their divergence |x_B(n) - x_A(n)|.
 */

(function (root) {
  'use strict';

  class ComparisonChart {
    constructor(canvasId, coordDisplayId) {
      this.coordEl = document.getElementById(coordDisplayId);
      this.base = new root.ChartBase(canvasId, {
        defaultDomain: { xmin: 0, xmax: 90, ymin: 0, ymax: 1 },
        labels: ['Iteration Number (n)', 'State Value x(n)'],
        onSelect: (pt) => this.updateCoord(pt)
      });

      this.base.renderCallback = () => this.draw();
      this.comparisonData = null;
      this.visibleSteps = null;
    }

    setData(comparisonData, visibleSteps = null) {
      this.comparisonData = comparisonData;
      this.visibleSteps = visibleSteps;

      if (comparisonData && comparisonData.seqA) {
        const count = comparisonData.seqA.length;
        if (this.base.view.xmin === this.base.defaultDomain.xmin &&
            this.base.view.xmax === this.base.defaultDomain.xmax) {
          this.base.defaultDomain.xmax = Math.max(10, count - 1);
          this.base.view.xmax = this.base.defaultDomain.xmax;
        }
      }

      this.draw();
    }

    updateCoord(pt) {
      if (!this.coordEl) return;
      if (!pt) {
        this.coordEl.innerHTML = '<span class="coord-placeholder">Selected point: none — click any point to inspect dual trajectory divergence.</span>';
        return;
      }

      const n = Math.round(pt.x);
      const xa = pt.xa !== undefined ? Number(pt.xa).toFixed(8) : Number(pt.y).toFixed(8);
      const xb = pt.xb !== undefined ? Number(pt.xb).toFixed(8) : '—';
      const diff = pt.diff !== undefined ? Number(pt.diff).toExponential(4) : '—';

      this.coordEl.innerHTML = `<strong>Selected Iteration n = ${n}:</strong> Trajectory A: <span style="color:#00e5ff">${xa}</span> &nbsp;|&nbsp; Trajectory B: <span style="color:#ff2a85">${xb}</span> &nbsp;|&nbsp; |Δx|: <span style="color:#ffc400">${diff}</span>`;
    }

    resetZoom() {
      const count = this.comparisonData ? this.comparisonData.seqA.length : 90;
      this.base.defaultDomain.xmax = Math.max(10, count - 1);
      this.base.resetZoom();
    }

    draw() {
      this.base.resize();
      this.base.drawGrid();

      const data = this.comparisonData;
      if (!data || !data.seqA || !data.seqB) return;

      const ctx = this.base.ctx;
      const count = data.seqA.length;
      const maxIdx = this.visibleSteps !== null ? Math.min(count - 1, this.visibleSteps) : count - 1;

      const pts = [];
      for (let i = 0; i <= maxIdx; i++) {
        pts.push({
          x: i,
          y: data.seqA[i],
          xa: data.seqA[i],
          xb: data.seqB[i],
          diff: data.diff[i]
        });
      }
      this.base.points = pts;

      ctx.save();
      ctx.setTransform(this.base.dpr, 0, 0, this.base.dpr, 0, 0);

      // Clip inside plot area
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.base.plot.left, this.base.plot.top, this.base.plot.width, this.base.plot.height);
      ctx.clip();

      // 1. Draw Difference Shading Area between the two curves
      ctx.fillStyle = 'rgba(255, 171, 0, 0.12)';
      ctx.beginPath();
      for (let i = 0; i <= maxIdx; i++) {
        const sx = this.base.toScreenX(i);
        const syA = this.base.toScreenY(data.seqA[i]);
        if (i === 0) ctx.moveTo(sx, syA);
        else ctx.lineTo(sx, syA);
      }
      for (let i = maxIdx; i >= 0; i--) {
        const sx = this.base.toScreenX(i);
        const syB = this.base.toScreenY(data.seqB[i]);
        ctx.lineTo(sx, syB);
      }
      ctx.closePath();
      ctx.fill();

      // 2. Trajectory A (Reference) — Electric Cyan
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(0, 229, 255, 0.4)';
      ctx.shadowBlur = 4;

      ctx.beginPath();
      for (let i = 0; i <= maxIdx; i++) {
        const sx = this.base.toScreenX(i);
        const sy = this.base.toScreenY(data.seqA[i]);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // 3. Trajectory B (Perturbed) — Hot Pink / Magenta
      ctx.strokeStyle = '#ff2a85';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(255, 42, 133, 0.4)';
      ctx.shadowBlur = 4;

      ctx.beginPath();
      for (let i = 0; i <= maxIdx; i++) {
        const sx = this.base.toScreenX(i);
        const sy = this.base.toScreenY(data.seqB[i]);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 4. Mark Divergence Step if reached
      if (data.divergenceStep !== -1 && data.divergenceStep <= maxIdx) {
        const divX = this.base.toScreenX(data.divergenceStep);
        ctx.strokeStyle = '#ffb300';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(divX, this.base.plot.top);
        ctx.lineTo(divX, this.base.plot.top + this.base.plot.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Divergence Badge
        ctx.fillStyle = '#ffb300';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(`⚡ DIVERGENCE (n = ${data.divergenceStep})`, divX + 6, this.base.plot.top + 20);
      }

      ctx.restore(); // end clip

      // 5. In-Chart Legend
      const legendX = this.base.plot.left + 12;
      const legendY = this.base.plot.top + 14;

      ctx.fillStyle = 'rgba(11, 19, 34, 0.85)';
      ctx.strokeStyle = '#25334a';
      ctx.lineWidth = 1;
      ctx.fillRect(legendX, legendY, 230, 48);
      ctx.strokeRect(legendX, legendY, 230, 48);

      // Trajectory A indicator
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(legendX + 8, legendY + 12, 12, 3);
      ctx.fillStyle = '#edf3ff';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Trajectory A: x₀ = ${Number(data.x0A).toFixed(4)}`, legendX + 26, legendY + 16);

      // Trajectory B indicator
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(legendX + 8, legendY + 30, 12, 3);
      ctx.fillStyle = '#edf3ff';
      ctx.fillText(`Trajectory B: x₀ = ${Number(data.x0B).toFixed(4)} (Δ = ${(data.initialDiff).toExponential(1)})`, legendX + 26, legendY + 34);

      // Highlight selected point
      this.base.drawSelectedHighlight('#ffb300');

      ctx.restore();
    }
  }

  root.ComparisonChart = ComparisonChart;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComparisonChart;
  }
})(typeof window !== 'undefined' ? window : globalThis);
