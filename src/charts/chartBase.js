/**
 * CHAOS ENGINE — Interactive Scientific Chart Engine (Canvas 2D)
 * Provides high-DPI rendering, pan & zoom (wheel + touch pinch), and point hit-testing.
 */

(function (root) {
  'use strict';

  class ChartBase {
    /**
     * @param {HTMLCanvasElement|string} canvasOrId
     * @param {object} options
     * @param {{ xmin: number, xmax: number, ymin: number, ymax: number }} options.defaultDomain
     * @param {string[]} options.labels [xLabel, yLabel]
     * @param {Function} options.onSelect Callback when a point is selected
     */
    constructor(canvasOrId, options = {}) {
      this.canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
      if (!this.canvas) throw new Error(`Canvas element not found: ${canvasOrId}`);

      this.ctx = this.canvas.getContext('2d');
      this.defaultDomain = { ...options.defaultDomain };
      this.view = { ...this.defaultDomain };
      this.labels = options.labels || ['X', 'Y'];
      this.onSelect = options.onSelect || null;

      this.margins = { left: 52, right: 18, top: 16, bottom: 42 };
      this.points = []; // Data points for nearest-neighbor hit testing [{x, y, ...meta}]
      this.selectedPoint = null;

      // Pointer drag & touch state
      this.dragState = null;
      this.touchDistance = null;

      this.initEvents();
    }

    /**
     * Set up canvas dimensions respecting devicePixelRatio
     */
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(10, Math.floor(rect.width));
      const h = Math.max(10, Math.floor(rect.height));

      if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
      }

      this.dpr = dpr;
      this.cssWidth = w;
      this.cssHeight = h;

      this.plot = {
        left: this.margins.left,
        top: this.margins.top,
        width: Math.max(10, w - this.margins.left - this.margins.right),
        height: Math.max(10, h - this.margins.top - this.margins.bottom)
      };
    }

    toScreenX(x) {
      return this.plot.left + ((x - this.view.xmin) / (this.view.xmax - this.view.xmin)) * this.plot.width;
    }

    toScreenY(y) {
      return this.plot.top + ((this.view.ymax - y) / (this.view.ymax - this.view.ymin)) * this.plot.height;
    }

    toWorldX(px) {
      return this.view.xmin + ((px - this.plot.left) / this.plot.width) * (this.view.xmax - this.view.xmin);
    }

    toWorldY(py) {
      return this.view.ymax - ((py - this.plot.top) / this.plot.height) * (this.view.ymax - this.view.ymin);
    }

    /**
     * Clear and draw scientific grid, ticks and axes
     */
    drawGrid() {
      const ctx = this.ctx;
      const w = this.cssWidth;
      const h = this.cssHeight;
      const plot = this.plot;

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Background
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, w, h);

      // Plot area background
      ctx.fillStyle = '#0b1322';
      ctx.fillRect(plot.left, plot.top, plot.width, plot.height);

      // Grid lines
      const xSpan = this.view.xmax - this.view.xmin;
      const ySpan = this.view.ymax - this.view.ymin;
      const steps = 4;

      ctx.strokeStyle = '#1a263d';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#7a8da8';
      ctx.font = '10px ui-monospace, monospace';

      for (let i = 0; i <= steps; i++) {
        // Vertical grid line & X tick
        const gx = plot.left + (i / steps) * plot.width;
        const valX = this.view.xmin + (i / steps) * xSpan;

        ctx.beginPath();
        ctx.moveTo(gx, plot.top);
        ctx.lineTo(gx, plot.top + plot.height);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillText(Number(valX).toFixed(xSpan < 1 ? 3 : xSpan < 10 ? 2 : 0), gx, plot.top + plot.height + 15);

        // Horizontal grid line & Y tick
        const gy = plot.top + (i / steps) * plot.height;
        const valY = this.view.ymax - (i / steps) * ySpan;

        ctx.beginPath();
        ctx.moveTo(plot.left, gy);
        ctx.lineTo(plot.left + plot.width, gy);
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillText(Number(valY).toFixed(ySpan < 0.1 ? 4 : ySpan < 2 ? 3 : 2), plot.left - 7, gy + 3.5);
      }

      // Plot border
      ctx.strokeStyle = '#2b3b55';
      ctx.lineWidth = 1;
      ctx.strokeRect(plot.left, plot.top, plot.width, plot.height);

      // Axis Labels
      ctx.fillStyle = '#00e5ff';
      ctx.font = '600 11px system-ui, sans-serif';

      // X Label
      ctx.textAlign = 'center';
      ctx.fillText(this.labels[0], plot.left + plot.width / 2, h - 8);

      // Y Label (rotated)
      ctx.save();
      ctx.translate(14, plot.top + plot.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(this.labels[1], 0, 0);
      ctx.restore();

      ctx.restore();
    }

    /**
     * Draw visual highlight ring on selected point
     */
    drawSelectedHighlight(color = '#ffb300') {
      if (!this.selectedPoint) return;
      const ctx = this.ctx;
      const px = this.toScreenX(this.selectedPoint.x);
      const py = this.toScreenY(this.selectedPoint.y);

      // Ensure inside plot area
      if (px < this.plot.left - 5 || px > this.plot.left + this.plot.width + 5 ||
          py < this.plot.top - 5 || py > this.plot.top + this.plot.height + 5) {
        return;
      }

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Outer glowing pulse ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.strokeStyle = 'rgba(255, 179, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(this.plot.left, py);
      ctx.lineTo(this.plot.left + this.plot.width, py);
      ctx.moveTo(px, this.plot.top);
      ctx.lineTo(px, this.plot.top + this.plot.height);
      ctx.stroke();

      // Center bright pip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    /**
     * Hit-test nearest point in screen coordinates
     */
    findNearest(px, py, maxDistPx = 30) {
      if (!this.points || !this.points.length) return null;
      let nearest = null;
      let minDistSq = maxDistPx * maxDistPx;

      for (let i = 0; i < this.points.length; i++) {
        const pt = this.points[i];
        const sx = this.toScreenX(pt.x);
        const sy = this.toScreenY(pt.y);
        const dx = sx - px;
        const dy = sy - py;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearest = pt;
        }
      }
      return nearest;
    }

    /**
     * Reset view to default domain
     */
    resetZoom() {
      this.view = { ...this.defaultDomain };
      this.selectedPoint = null;
      if (this.onSelect) this.onSelect(null);
      if (this.renderCallback) this.renderCallback();
    }

    /**
     * Initialize interaction events (mouse, touch, wheel)
     */
    initEvents() {
      const c = this.canvas;

      c.addEventListener('pointerdown', (e) => {
        c.setPointerCapture(e.pointerId);
        this.dragState = {
          startX: e.offsetX,
          startY: e.offsetY,
          origView: { ...this.view },
          moved: false
        };
      });

      c.addEventListener('pointermove', (e) => {
        if (!this.dragState) return;
        const dx = e.offsetX - this.dragState.startX;
        const dy = e.offsetY - this.dragState.startY;

        if (Math.abs(dx) + Math.abs(dy) > 4) {
          this.dragState.moved = true;
        }

        if (this.dragState.moved) {
          const xSpan = this.dragState.origView.xmax - this.dragState.origView.xmin;
          const ySpan = this.dragState.origView.ymax - this.dragState.origView.ymin;
          const sx = xSpan / this.plot.width;
          const sy = ySpan / this.plot.height;

          this.view = {
            xmin: this.dragState.origView.xmin - dx * sx,
            xmax: this.dragState.origView.xmax - dx * sx,
            ymin: this.dragState.origView.ymin + dy * sy,
            ymax: this.dragState.origView.ymax + dy * sy
          };

          if (this.renderCallback) this.renderCallback();
        }
      });

      c.addEventListener('pointerup', (e) => {
        if (!this.dragState) return;
        const wasDrag = this.dragState.moved;
        this.dragState = null;

        if (!wasDrag) {
          // It was a click/tap: perform coordinate inspection
          const px = e.offsetX;
          const py = e.offsetY;

          if (px >= this.plot.left && px <= this.plot.left + this.plot.width &&
              py >= this.plot.top && py <= this.plot.top + this.plot.height) {
            const hit = this.findNearest(px, py, 35);
            if (hit) {
              this.selectedPoint = hit;
            } else {
              // Clicked empty region: inspect exact cursor coordinate
              this.selectedPoint = {
                x: this.toWorldX(px),
                y: this.toWorldY(py),
                isArbitrary: true
              };
            }
            if (this.onSelect) this.onSelect(this.selectedPoint);
            if (this.renderCallback) this.renderCallback();
          }
        }
      });

      c.addEventListener('pointercancel', () => {
        this.dragState = null;
      });

      // Zoom on mouse wheel
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 0.85 : 1.18;
        const px = e.offsetX;
        const py = e.offsetY;

        const anchorX = this.toWorldX(px);
        const anchorY = this.toWorldY(py);

        this.view = {
          xmin: anchorX + (this.view.xmin - anchorX) * factor,
          xmax: anchorX + (this.view.xmax - anchorX) * factor,
          ymin: anchorY + (this.view.ymin - anchorY) * factor,
          ymax: anchorY + (this.view.ymax - anchorY) * factor
        };

        if (this.renderCallback) this.renderCallback();
      }, { passive: false });
    }
  }

  root.ChartBase = ChartBase;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartBase;
  }
})(typeof window !== 'undefined' ? window : globalThis);
