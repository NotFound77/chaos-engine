/**
 * CHAOS ENGINE — Web Serial Communication Manager
 * Integrates Chromium Web Serial API with the Arduino Uno R3 controller.
 * Baud rate: 115200.
 */

(function (root) {
  'use strict';

  class SerialManager {
    constructor() {
      this.port = null;
      this.reader = null;
      this.readableStreamClosed = null;
      this.isConnected = false;
      this.isReading = false;
      this.baudRate = 115200;
      this.buffer = '';

      // Bridge connection (for Firefox & universal compatibility)
      this.eventSource = null;
      this.isBridgeConnected = false;

      // Event listeners
      this.listeners = {
        status: [],
        param: [],
        event: [],
        ready: [],
        raw: [],
        error: []
      };

      // Register disconnect listener if supported
      if (typeof navigator !== 'undefined' && 'serial' in navigator) {
        navigator.serial.addEventListener('disconnect', (event) => {
          if (this.port && event.target === this.port) {
            this.handleDisconnect('Hardware unplugged');
          }
        });
      }
    }

    /**
     * Check if Web Serial API is supported in current browser
     */
    isSupported() {
      return typeof navigator !== 'undefined' && 'serial' in navigator;
    }

    on(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event].push(callback);
      }
      return this;
    }

    emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(cb => {
          try {
            cb(data);
          } catch (err) {
            console.error(`Error in serial listener [${event}]:`, err);
          }
        });
      }
    }

    /**
     * Connect using Web Serial API or Server Bridge (fallback for Firefox on localhost)
     */
    async connect(preferBridge = false) {
      if (this.isConnected) return true;

      const isLocalhost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      // If Web Serial is supported and bridge not explicitly forced, try Web Serial
      if (this.isSupported() && !preferBridge) {
        try {
          return await this.connectWebSerial();
        } catch (err) {
          console.warn('Web Serial connection failed or cancelled.', err);
          if (isLocalhost) {
            console.log('Attempting local server bridge fallback on localhost...');
            return await this.connectBridge();
          }
          throw err;
        }
      } else {
        // When Web Serial is unsupported (e.g. Firefox)
        if (isLocalhost) {
          return await this.connectBridge();
        } else {
          const msg = 'Web Serial API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Brave on desktop.';
          this.emit('error', msg);
          this.emit('status', {
            connected: false,
            mode: 'SIMULATION_MODE',
            message: msg
          });
          throw new Error(msg);
        }
      }
    }

    /**
     * Connect via native Chromium Web Serial API
     */
    async connectWebSerial() {
      try {
        this.port = await navigator.serial.requestPort({});

        await this.port.open({
          baudRate: this.baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          bufferSize: 1024,
          flowControl: 'none'
        });

        this.isConnected = true;
        this.buffer = '';
        this.emit('status', {
          connected: true,
          mode: 'HARDWARE_CONNECTED',
          message: 'Connected to Arduino Uno R3 via Web Serial API'
        });

        this.startReading();
        return true;
      } catch (err) {
        this.isConnected = false;
        this.port = null;
        const errMsg = err.name === 'NotFoundError' ? 'No serial device was selected.' : (err.message || 'Serial connection failed.');
        throw new Error(errMsg);
      }
    }

    /**
     * Connect via Local Server Bridge (Works in all browsers including Firefox)
     */
    async connectBridge() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      return new Promise((resolve, reject) => {
        try {
          this.eventSource = new EventSource('/api/serial-events');

          this.eventSource.onopen = () => {
            this.isConnected = true;
            this.isBridgeConnected = true;
            this.emit('status', {
              connected: true,
              mode: 'HARDWARE_CONNECTED',
              message: 'Connected via Local Serial Bridge (Universal / Firefox compatible)'
            });
            resolve(true);
          };

          this.eventSource.onmessage = (e) => {
            if (!e.data) return;
            // Handle STATUS messages from bridge
            if (e.data.startsWith('STATUS,')) {
              const parts = e.data.split(',');
              const isHwUp = parts[1] === '1';
              const portName = parts[2];
              const errorMsg = parts.slice(3).join(',');

              if (!isHwUp && errorMsg) {
                this.emit('status', {
                  connected: false,
                  mode: 'SIMULATION_MODE',
                  message: errorMsg
                });
              } else if (isHwUp) {
                this.emit('status', {
                  connected: true,
                  mode: 'HARDWARE_CONNECTED',
                  message: `Connected to ${portName} via Local Bridge`
                });
              }
              return;
            }

            this.processLine(e.data);
          };

          this.eventSource.onerror = (err) => {
            if (!this.isConnected) {
              const msg = 'Local bridge is not running. (Run: python3 server.py)';
              this.emit('status', {
                connected: false,
                mode: 'SIMULATION_MODE',
                message: msg
              });
              if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
              }
              reject(new Error(msg));
            }
          };
        } catch (err) {
          reject(err);
        }
      });
    }

    /**
     * Continuously read incoming serial stream with line buffering
     */
    async startReading() {
      if (!this.port || !this.port.readable || this.isReading) return;
      this.isReading = true;

      const textDecoder = new TextDecoder();

      try {
        while (this.port && this.port.readable && this.isConnected) {
          this.reader = this.port.readable.getReader();
          try {
            while (true) {
              const { value, done } = await this.reader.read();
              if (done) {
                break;
              }
              if (value) {
                const chunk = textDecoder.decode(value, { stream: true });
                this.handleChunk(chunk);
              }
            }
          } catch (readErr) {
            if (this.isConnected) {
              console.warn('Serial read error:', readErr);
            }
          } finally {
            if (this.reader) {
              this.reader.releaseLock();
              this.reader = null;
            }
          }
        }
      } catch (err) {
        console.warn('Serial stream loop terminated:', err);
      } finally {
        this.isReading = false;
        if (this.isConnected) {
          this.handleDisconnect('Serial stream closed');
        }
      }
    }

    /**
     * Buffer incoming chunks and emit complete lines
     */
    handleChunk(chunk) {
      this.buffer += chunk;
      let newlineIdx;

      while ((newlineIdx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newlineIdx).replace(/\r$/, '');
        this.buffer = this.buffer.slice(newlineIdx + 1);

        if (line.length > 0) {
          this.processLine(line);
        }
      }

      // Safeguard against run-away buffer if no newlines appear
      if (this.buffer.length > 2048) {
        this.buffer = this.buffer.slice(-512);
      }
    }

    /**
     * Parse message line and route to appropriate listeners
     */
    processLine(line) {
      this.emit('raw', line);

      const Protocol = root.ChaosProtocol || window.ChaosProtocol;
      if (!Protocol) return;

      const parsed = Protocol.parseMessage(line);
      if (!parsed.valid) {
        return; // Ignore malformed lines safely
      }

      switch (parsed.type) {
        case 'READY':
          this.emit('ready', parsed.data);
          break;
        case 'PARAM':
          this.emit('param', parsed.data);
          break;
        case 'EVENT':
          this.emit('event', parsed.data.event);
          break;
        default:
          break;
      }
    }

    /**
     * Disconnect cleanly
     */
    async disconnect() {
      if (!this.isConnected && !this.port && !this.eventSource) return;

      this.isConnected = false;
      this.isBridgeConnected = false;

      if (this.eventSource) {
        try {
          this.eventSource.close();
        } catch (err) {}
        this.eventSource = null;
      }

      try {
        if (this.reader) {
          await this.reader.cancel();
          // Lock is released in startReading's finally block
        }
      } catch (err) {
        console.warn('Error canceling reader:', err);
      }

      try {
        if (this.port) {
          await this.port.close();
        }
      } catch (err) {
        console.warn('Error closing port:', err);
      }

      this.port = null;
      this.reader = null;
      this.isReading = false;
      this.buffer = '';

      this.emit('status', {
        connected: false,
        mode: 'SIMULATION_MODE',
        message: 'Arduino disconnected. Operating in Simulation Mode.'
      });
    }

    handleDisconnect(reason) {
      this.disconnect();
      this.emit('status', {
        connected: false,
        mode: 'SIMULATION_MODE',
        message: `Hardware disconnected (${reason}). Switched to Simulation Mode.`
      });
    }

    /**
     * Virtual Serial Simulator:
     * Injects synthetic serial line as if received from the hardware.
     */
    injectSimulatedLine(line) {
      this.processLine(line);
    }
  }

  const ChaosSerial = new SerialManager();

  root.ChaosSerial = ChaosSerial;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChaosSerial;
  }
})(typeof window !== 'undefined' ? window : globalThis);
