/*
 * ==============================================================================
 * CHAOS ENGINE — Logistic Map Machine
 * Physical Controller Firmware for Arduino Uno R3
 * ==============================================================================
 *
 * Hardware Configuration:
 *   - Potentiometer 1 (r)          -> Pin A0 (Controls r in range 0.000 to 4.000)
 *   - Potentiometer 2 (x0)         -> Pin A1 (Controls x0 in range 0.000 to 1.000)
 *   - Rotary Encoder CLK           -> Pin D2 (Hardware interrupt pin)
 *   - Rotary Encoder DT            -> Pin D3 (Direction pin)
 *   - Rotary Encoder Switch (SW)   -> Pin D4 (INPUT_PULLUP)
 *   - Button 1: START / PAUSE      -> Pin D5 (INPUT_PULLUP)
 *   - Button 2: RESET              -> Pin D6 (INPUT_PULLUP)
 *   - Button 3: COMPARE            -> Pin D7 (INPUT_PULLUP)
 *
 * Serial Communication:
 *   - Baud Rate: 115200
 *   - Output Messages:
 *       READY,CHAOS_ENGINE,1
 *       PARAM,r,x0,N
 *       EVENT,START
 *       EVENT,RESET
 *       EVENT,COMPARE
 *       EVENT,ENCODER_PRESS
 * ==============================================================================
 */

// Pin Definitions
const int PIN_POT_R      = A0;
const int PIN_POT_X0     = A1;
const int PIN_ENC_CLK    = 2;
const int PIN_ENC_DT     = 3;
const int PIN_ENC_SW     = 4;
const int PIN_BTN_START  = 5;
const int PIN_BTN_RESET  = 6;
const int PIN_BTN_COMPARE= 7;

// Parameter State
float currentR  = 0.940f;
float currentX0 = 0.460f;
volatile int currentN = 90; // Modified in interrupt / encoder routine

// Last Sent Values (for deadband filtering)
float lastSentR  = -1.0f;
float lastSentX0 = -1.0f;
int   lastSentN  = -1;

// Rotary Encoder Quadrature Tracking
volatile int lastEncoded = 0;
const int ENCODER_STEP = 5;

// Button Debounce Timing
const unsigned long DEBOUNCE_MS = 50;

struct Button {
  int pin;
  int lastState;
  unsigned long lastDebounceTime;
  const char* eventName;
};

Button buttons[] = {
  { PIN_BTN_START,   HIGH, 0, "START" },
  { PIN_BTN_RESET,   HIGH, 0, "RESET" },
  { PIN_BTN_COMPARE, HIGH, 0, "COMPARE" },
  { PIN_ENC_SW,      HIGH, 0, "ENCODER_PRESS" }
};
const int NUM_BUTTONS = sizeof(buttons) / sizeof(buttons[0]);

// Telemetry Timing
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 30; // Max 33Hz stream to prevent serial buffer overrun

// Function Declarations
void handleEncoderInterrupt();
void readPotentiometers();
void checkButtons();
void sendParamMessage(float r, float x0, int n);

void setup() {
  // Initialize Serial at 115200 baud
  Serial.begin(115200);
  while (!Serial && millis() < 1000); // Wait briefly for USB Serial connection

  // Configure Button & Encoder Inputs with Internal Pull-Ups
  pinMode(PIN_ENC_CLK, INPUT_PULLUP);
  pinMode(PIN_ENC_DT, INPUT_PULLUP);
  pinMode(PIN_ENC_SW, INPUT_PULLUP);
  pinMode(PIN_BTN_START, INPUT_PULLUP);
  pinMode(PIN_BTN_RESET, INPUT_PULLUP);
  pinMode(PIN_BTN_COMPARE, INPUT_PULLUP);

  // Attach Interrupt on Rotary Encoder CLK pin
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_CLK), handleEncoderInterrupt, CHANGE);

  // Read initial states
  readPotentiometers();

  // Send Initial Handshake & Parameters
  delay(150);
  Serial.println(F("READY,CHAOS_ENGINE,1"));
  sendParamMessage(currentR, currentX0, currentN);
}

void loop() {
  // 1. Process Buttons with Debouncing
  checkButtons();

  // 2. Sample Potentiometers & Transmit Telemetry
  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    readPotentiometers();

    // Check if parameters have changed beyond deadband threshold
    bool rChanged  = fabs(currentR - lastSentR) >= 0.004f;
    bool x0Changed = fabs(currentX0 - lastSentX0) >= 0.002f;
    bool nChanged  = currentN != lastSentN;

    if (rChanged || x0Changed || nChanged) {
      sendParamMessage(currentR, currentX0, currentN);
      lastSentR  = currentR;
      lastSentX0 = currentX0;
      lastSentN  = currentN;
    }
  }
}

/**
 * Interrupt Service Routine for KY-040 Rotary Encoder
 * Implements gray-code quadrature decoding for robust, bounce-free counting.
 */
void handleEncoderInterrupt() {
  int MSB = digitalRead(PIN_ENC_CLK);
  int LSB = digitalRead(PIN_ENC_DT);
  int encoded = (MSB << 1) | LSB;
  int sum = (lastEncoded << 2) | encoded;

  // Clockwise rotation
  if (sum == 0b1101 || sum == 0b0100 || sum == 0b0010 || sum == 0b1011) {
    if (currentN + ENCODER_STEP <= 500) {
      currentN += ENCODER_STEP;
    } else {
      currentN = 500;
    }
  }
  // Counter-Clockwise rotation
  else if (sum == 0b1110 || sum == 0b0111 || sum == 0b0001 || sum == 0b1000) {
    if (currentN - ENCODER_STEP >= 5) {
      currentN -= ENCODER_STEP;
    } else {
      currentN = 5;
    }
  }

  lastEncoded = encoded;
}

/**
 * Read Analog Potentiometers with multi-sample oversampling filter
 */
void readPotentiometers() {
  // 4-sample average to filter ADC noise
  long sumA0 = 0;
  long sumA1 = 0;
  const int SAMPLES = 4;

  for (int i = 0; i < SAMPLES; i++) {
    sumA0 += analogRead(PIN_POT_R);
    sumA1 += analogRead(PIN_POT_X0);
  }

  float avgA0 = (float)sumA0 / SAMPLES;
  float avgA1 = (float)sumA1 / SAMPLES;

  // Map A0 (0..1023) to Growth Parameter r (0.000 to 4.000)
  currentR = (avgA0 / 1023.0f) * 4.0f;
  if (currentR < 0.001f) currentR = 0.0f;
  if (currentR > 3.999f) currentR = 4.0f;

  // Map A1 (0..1023) to Initial Condition x0 (0.000 to 1.000)
  currentX0 = (avgA1 / 1023.0f) * 1.0f;
  if (currentX0 < 0.001f) currentX0 = 0.0f;
  if (currentX0 > 0.999f) currentX0 = 1.0f;
}

/**
 * Debounce and trigger button push events
 */
void checkButtons() {
  unsigned long now = millis();

  for (int i = 0; i < NUM_BUTTONS; i++) {
    int reading = digitalRead(buttons[i].pin);

    // If reading changed (due to noise or press)
    if (reading != buttons[i].lastState) {
      if (now - buttons[i].lastDebounceTime > DEBOUNCE_MS) {
        // Falling edge: button pressed (connected to GND via INPUT_PULLUP)
        if (reading == LOW) {
          Serial.print(F("EVENT,"));
          Serial.println(buttons[i].eventName);

          // If RESET button pressed, restore firmware default parameters
          if (strcmp(buttons[i].eventName, "RESET") == 0) {
            currentR  = 0.940f;
            currentX0 = 0.460f;
            currentN  = 90;
            sendParamMessage(currentR, currentX0, currentN);
            lastSentR  = currentR;
            lastSentX0 = currentX0;
            lastSentN  = currentN;
          }
        }
        buttons[i].lastState = reading;
        buttons[i].lastDebounceTime = now;
      }
    }
  }
}

/**
 * Transmit PARAM telemetry line
 */
void sendParamMessage(float r, float x0, int n) {
  Serial.print(F("PARAM,"));
  Serial.print(r, 3);
  Serial.print(F(","));
  Serial.print(x0, 3);
  Serial.print(F(","));
  Serial.println(n);
}
