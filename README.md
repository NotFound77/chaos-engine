# ⚡ CHAOS ENGINE — Logistic Map Machine
### Interactive Physical Mathematics Exhibition & Real-Time Dynamical Systems Lab

[![Live on Vercel](https://img.shields.io/badge/Vercel-Live%20Deployment-000000?style=for-the-badge&logo=vercel)](https://chaos-engine-snowy.vercel.app)
[![Live on GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Site-222222?style=for-the-badge&logo=github)](https://notfound77.github.io/chaos-engine/)
![Hardware](https://img.shields.io/badge/Hardware-Arduino%20Uno%20R3-00e676?style=for-the-badge)
![Communication](https://img.shields.io/badge/Serial-Web%20Serial%20API-ffab00?style=for-the-badge)

**Live Production URLs:**
- **Vercel**: [https://chaos-engine-snowy.vercel.app](https://chaos-engine-snowy.vercel.app)
- **GitHub Pages**: [https://notfound77.github.io/chaos-engine/](https://notfound77.github.io/chaos-engine/)

**CHAOS ENGINE** is an interactive scientific instrument designed for physical mathematics exhibitions. A visitor physically manipulates growth rates, initial conditions, and iteration depth using an **Arduino Uno R3** physical console, while a laptop computes non-linear recurrence equations live and renders six synchronized scientific visualisations at 60 FPS.

---

## 📐 1. Mathematical Foundation

The core recurrence equation is the **Logistic Map**:

$$x_{n+1} = r \cdot x_n \cdot (1 - x_n)$$

Where:
- **$r \in [0, 4]$**: Growth parameter (non-linear feedback intensity), physically controlled via Potentiometer 1.
- **$x_0 \in [0, 1]$**: Initial condition (starting population fraction), physically controlled via Potentiometer 2.
- **$N \in [5, 500]$**: Iteration depth, controlled via KY-040 Rotary Encoder (in steps of 5).

### Fixed Points and Linear Stability
A fixed point satisfies $x^* = f(x^*) = r x^*(1 - x^*)$:
1. **$x^*_1 = 0$** (Trivial fixed point):
   - Derivative: $f'(0) = r$
   - Stable if $|r| < 1$; unstable for $r > 1$.
2. **$x^*_2 = \frac{r - 1}{r}$** (Non-trivial fixed point, physical in $[0, 1]$ for $r \ge 1$):
   - Derivative: $f'(x^*_2) = 2 - r$
   - Stable if $|2 - r| < 1 \iff 1 < r < 3$. At $r = 3$, the system undergoes its first flip (period-doubling) bifurcation.

### Lyapunov Exponent ($\lambda$)
Calculates the asymptotic rate of exponential separation of infinitesimally close trajectories:

$$\lambda = \lim_{M \to \infty} \frac{1}{M} \sum_{i=0}^{M-1} \ln |f'(x_i)| = \lim_{M \to \infty} \frac{1}{M} \sum_{i=0}^{M-1} \ln |r(1 - 2x_i)|$$

- $\lambda < 0$: Stable periodic orbit / fixed point attractor.
- $\lambda = 0$: Bifurcation point.
- $\lambda > 0$: **Deterministic Chaos** (exponential divergence / Butterfly Effect).

---

## 🔌 2. Hardware Wiring & Pin Configuration

The physical controller runs on an **Arduino Uno R3**:

| Component | Arduino Pin | Circuit Type | Function in Chaos Engine |
|---|---|---|---|
| **Potentiometer 1** | **A0** | Analog In (0–5V) | Controls parameter **$r$** ($0.000$ to $4.000$) |
| **Potentiometer 2** | **A1** | Analog In (0–5V) | Controls initial condition **$x_0$** ($0.000$ to $1.000$) |
| **KY-040 Encoder CLK** | **D2** | Digital In / INT0 | Quadrature Clock (Hardware Interrupt) |
| **KY-040 Encoder DT** | **D3** | Digital In | Quadrature Direction ($N \pm 5$) |
| **KY-040 Encoder SW** | **D4** | `INPUT_PULLUP` &rarr; GND | Push-button (Cycle Presets) |
| **START / PAUSE Button** | **D5** | `INPUT_PULLUP` &rarr; GND | Toggle running/paused experiment |
| **RESET Button** | **D6** | `INPUT_PULLUP` &rarr; GND | Reset to defaults ($r=0.94, x_0=0.46, N=90$) |
| **COMPARE Button** | **D7** | `INPUT_PULLUP` &rarr; GND | Toggle dual trajectory comparison |

*All buttons connect between their respective digital pin and Arduino GND. Internal pull-up resistors are enabled in software.*

---

## 📡 3. Serial Communication Protocol

The Arduino and browser communicate via the **Web Serial API** at **115200 baud**:

| Packet | Example | Description |
|---|---|---|
| `READY` | `READY,CHAOS_ENGINE,1` | Boot handshake sent on Arduino startup. |
| `PARAM` | `PARAM,2.350,0.460,90` | Parameter stream ($r$, $x_0$, $N$) with deadband filtering. |
| `EVENT` | `EVENT,START` | Triggers experiment playback / pause. |
| `EVENT` | `EVENT,RESET` | Restores default parameters and zoom. |
| `EVENT` | `EVENT,COMPARE` | Toggles Trajectory Comparison mode. |
| `EVENT` | `EVENT,ENCODER_PRESS`| Cycles preset experiments. |

---

## 📊 4. Six Scientific Visualisation Components

1. **Iteration Graph ($x_n$ vs $n$)**:
   - Plots the discrete trajectory with cyan glowing lines and gold data markers.
   - Click to inspect coordinates $(n, x_n)$. Drag to pan; scroll to zoom.
2. **Cobweb Diagram ($x_{n+1}$ vs $x_n$)**:
   - Plots the parabola $f(x) = rx(1-x)$, identity line $y=x$, and iterative cobweb path.
   - Highlights fixed points and convergence cycles.
3. **Fixed Points & Linear Stability**:
   - Computes analytical fixed points $x^*$, derivatives $f'(x^*)$, and stability classification badges.
4. **Bifurcation Diagram ($x^*$ vs $r \in [0, 4]$)**:
   - Discards transient iterations and renders long-term attractors across the parameter spectrum.
   - Buffered offscreen canvas allows 60 FPS vertical cursor tracking of current $r$.
5. **Comparison Graph (Sensitivity to Initial Conditions)**:
   - Trajectory A (Cyan, $x_{0A}$) vs Trajectory B (Magenta, $x_{0B} = x_{0A} + \Delta x_0$).
   - Highlights divergence step $n_{\text{div}}$ and visualizes the exponential separation.
6. **Coordinate Display**:
   - Dedicated coordinate panels below every graph with pinned coordinates and inspection tools.

---

## 🚀 5. How to Run the Application

### Step 1: Clone / Navigate to Workspace
```bash
cd /home/vedtz/CHAOS_ENGINE
```

### Step 2: Start a Local Web Server
> **Note on Web Serial Security:** Modern Chromium browsers require Web Serial to be accessed via `http://localhost:*` or `https://` (disabled on `file://` for security).

```bash
# Using Python:
python3 -m http.server 8000

# Or using Node:
npm start
```

### Step 3: Open in Chromium / Chrome / Edge
Open your browser and navigate to:
```
http://localhost:8000
```

### Step 4: Connect the Arduino
1. Plug the Arduino Uno R3 into your laptop via USB.
2. Click **CONNECT ARDUINO (115200 BAUD)** in the top right corner.
3. Select the Arduino serial port (e.g. `/dev/ttyACM0`, `/dev/ttyUSB0`, or `COM3`) and click **Connect**.
4. The status pill will switch to **HARDWARE CONNECTED**. Rotating physical knobs will now drive the visualisations in real time!

---

## 🛠 6. Uploading the Firmware to Arduino Uno

1. Open `arduino/chaos_engine.ino` in the **Arduino IDE**.
2. Select Board: **Arduino Uno**.
3. Select Port: Your Arduino USB COM port.
4. Click **Upload** (Ctrl + U / Cmd + U).

---

## 🧪 7. Automated Test Suite

Run the full integration test suite in Node.js:

```bash
npm test
```
Verifies math calculations, fixed point stability, Lyapunov exponents, serial protocol parsing, event dispatching, and disconnection fallbacks.

---

## ℹ️ 8. Honest Limitations & Browser Requirements
1. **Web Serial API Support**: The Web Serial API is natively supported in Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Opera, Chromium). Firefox and Safari do not currently support the Web Serial API standard, but the application automatically falls back to full **SIMULATION MODE** on any browser.
2. **Localhost Origin**: Web Serial requires a secure context (`http://localhost` or HTTPS). Always use `python3 -m http.server` rather than opening `index.html` directly as `file://`.
