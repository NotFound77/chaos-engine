#!/usr/bin/env python3
"""
CHAOS ENGINE — Unified Web Server & Serial Bridge
Serves web application static files and relays Arduino USB serial data via Server-Sent Events (SSE).
Compatible with all browsers (Chrome, Edge, Firefox, Safari) without any extra dependencies.
"""

import os
import sys
import time
import glob
import threading
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

try:
    import serial
except ImportError:
    serial = None

PORT = 8000
SERIAL_BAUD = 115200

# Global state
active_clients = []
active_clients_lock = threading.Lock()
serial_port_name = None
serial_connected = False
serial_error_message = ""

def find_arduino_port():
    """Detect candidate Arduino USB serial ports on Linux/macOS/Windows"""
    candidates = glob.glob('/dev/ttyACM*') + glob.glob('/dev/ttyUSB*') + glob.glob('/dev/cu.usbmodem*')
    return candidates[0] if candidates else None

def get_busy_process(port_path):
    """Find PID of process holding port open, if any"""
    try:
        out = subprocess.check_output(['lsof', port_path], stderr=subprocess.DEVNULL).decode()
        for line in out.splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 2:
                return parts[0], parts[1]
    except Exception:
        pass
    return None, None

def serial_worker():
    """Background worker that manages connection to Arduino USB serial port"""
    global serial_connected, serial_port_name, serial_error_message

    if serial is None:
        serial_error_message = "pyserial module not installed"
        print("[BRIDGE ERROR]", serial_error_message)
        return

    while True:
        port = find_arduino_port()
        if not port:
            serial_connected = False
            serial_port_name = None
            serial_error_message = "No Arduino USB device detected. Please connect Arduino Uno."
            time.sleep(2)
            continue

        serial_port_name = port

        # Check if port is locked by another process (e.g. Arduino IDE serial monitor)
        proc_name, pid = get_busy_process(port)
        if pid:
            serial_connected = False
            serial_error_message = f"Port {port} is busy! Locked by '{proc_name}' (PID: {pid}). Close the Serial Monitor in Arduino IDE."
            print(f"[BRIDGE WARNING] {serial_error_message}")
            time.sleep(2)
            continue

        try:
            print(f"[BRIDGE] Connecting to {port} at {SERIAL_BAUD} baud...")
            with serial.Serial(port, SERIAL_BAUD, timeout=1) as ser:
                serial_connected = True
                serial_error_message = ""
                print(f"[BRIDGE] Connected successfully to {port}!")
                broadcast_sse("READY,CHAOS_ENGINE,1")

                while True:
                    line = ser.readline()
                    if line:
                        decoded = line.decode('utf-8', errors='ignore').strip()
                        if decoded:
                            broadcast_sse(decoded)
        except Exception as e:
            serial_connected = False
            serial_error_message = str(e)
            print(f"[BRIDGE ERROR] Serial connection dropped ({e}). Retrying in 2s...")
            time.sleep(2)

def broadcast_sse(msg):
    """Broadcast serial message to all connected web clients"""
    data = f"data: {msg}\n\n".encode('utf-8')
    with active_clients_lock:
        to_remove = []
        for client in active_clients:
            try:
                client.wfile.write(data)
                client.wfile.flush()
            except Exception:
                to_remove.append(client)
        for client in to_remove:
            if client in active_clients:
                active_clients.remove(client)

class ChaosRequestHandler(SimpleHTTPRequestHandler):
    """HTTP Handler supporting static files and SSE streaming"""

    def do_GET(self):
        # Route 1: Serial Events SSE Stream
        if self.path == '/api/serial-events':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            # Send initial connection handshake
            init_msg = f"STATUS,{1 if serial_connected else 0},{serial_port_name or 'NONE'},{serial_error_message}\n\n"
            try:
                self.wfile.write(f"data: {init_msg}".encode('utf-8'))
                self.wfile.flush()
            except Exception:
                return

            with active_clients_lock:
                active_clients.append(self)

            # Keep connection open until client disconnects
            try:
                while True:
                    time.sleep(1)
            except Exception:
                pass
            finally:
                with active_clients_lock:
                    if self in active_clients:
                        active_clients.remove(self)
            return

        # Route 2: Status check JSON
        if self.path == '/api/status':
            import json
            payload = json.dumps({
                "connected": serial_connected,
                "port": serial_port_name,
                "error": serial_error_message
            }).encode('utf-8')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # Route 3: Standard static file serving
        return super().do_GET()

    def log_message(self, format, *args):
        # Suppress noisy GET log requests for static assets
        if '/api/' in args[0] or 'index.html' in args[0]:
            super().log_message(format, *args)

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print("=" * 60)
    print("⚡ CHAOS ENGINE — Server & Hardware Bridge")
    print("=" * 60)

    # Start serial background thread
    t = threading.Thread(target=serial_worker, daemon=True)
    t.start()

    server = ThreadingHTTPServer(('0.0.0.0', PORT), ChaosRequestHandler)
    print(f"✔ Web Server listening at: http://localhost:{PORT}")
    print(f"✔ Open in any browser: Chrome, Edge, Firefox, or Safari")
    print("=" * 60)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == '__main__':
    main()
