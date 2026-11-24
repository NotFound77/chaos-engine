#include <Arduino.h>

// ---------------- PIN DEFINITIONS ----------------

// Potentiometers
#define POT_R A0
#define POT_X0 A1

// KY-040 Rotary Encoder
#define ENC_CLK 2
#define ENC_DT  3
#define ENC_SW  4

// Push Buttons
#define BTN_START   5
#define BTN_RESET   6
#define BTN_COMPARE 7

// ---------------- PARAMETERS ----------------

float r = 0.94;
float x0 = 0.46;

int iterations = 90;

int lastCLK;

unsigned long lastEncoderTime = 0;
unsigned long lastSendTime = 0;

// ---------------- BUTTON STRUCT ----------------

struct Button {
  byte pin;
  bool lastReading;
  bool stableState;
  unsigned long lastChange;
};

// Initialize buttons
Button startButton   = {BTN_START, HIGH, HIGH, 0};
Button resetButton   = {BTN_RESET, HIGH, HIGH, 0};
Button compareButton = {BTN_COMPARE, HIGH, HIGH, 0};
Button encoderButton = {ENC_SW, HIGH, HIGH, 0};

// ---------------- BUTTON DEBOUNCING ----------------

bool pressed(Button &b) {

  bool reading = digitalRead(b.pin);

  if (reading != b.lastReading) {
    b.lastChange = millis();
    b.lastReading = reading;
  }

  if (millis() - b.lastChange >= 30) {

    if (reading != b.stableState) {

      b.stableState = reading;

      if (reading == LOW) {
        return true;
      }
    }
  }

  return false;
}

// ---------------- READ POTENTIOMETERS ----------------

void readParameters() {

  int rawR = analogRead(POT_R);
  int rawX0 = analogRead(POT_X0);

  r = rawR * (4.0 / 1023.0);

  x0 = rawX0 * (1.0 / 1023.0);
}

// ---------------- ROTARY ENCODER ----------------

void readEncoder() {

  int clk = digitalRead(ENC_CLK);

  if (lastCLK == HIGH && clk == LOW) {

    if (millis() - lastEncoderTime > 3) {

      if (digitalRead(ENC_DT) == HIGH) {
        iterations += 5;
      } 
      else {
        iterations -= 5;
      }

      iterations = constrain(iterations, 5, 500);

      lastEncoderTime = millis();
    }
  }

  lastCLK = clk;
}

// ---------------- SERIAL OUTPUT ----------------

void sendParameters() {

  if (millis() - lastSendTime >= 100) {

    Serial.print("PARAM,");
    Serial.print(r, 3);
    Serial.print(",");
    Serial.print(x0, 3);
    Serial.print(",");
    Serial.println(iterations);

    lastSendTime = millis();
  }
}

// ---------------- SETUP ----------------

void setup() {

  Serial.begin(115200);

  pinMode(ENC_CLK, INPUT_PULLUP);
  pinMode(ENC_DT, INPUT_PULLUP);
  pinMode(ENC_SW, INPUT_PULLUP);

  pinMode(BTN_START, INPUT_PULLUP);
  pinMode(BTN_RESET, INPUT_PULLUP);
  pinMode(BTN_COMPARE, INPUT_PULLUP);

  lastCLK = digitalRead(ENC_CLK);

  Serial.println("READY,CHAOS_ENGINE,1");
}

// ---------------- MAIN LOOP ----------------

void loop() {

  // Read potentiometers
  readParameters();

  // Read rotary encoder
  readEncoder();

  // START / PAUSE
  if (pressed(startButton)) {
    Serial.println("EVENT,START");
  }

  // RESET
  if (pressed(resetButton)) {

    iterations = 90;

    Serial.println("EVENT,RESET");
  }

  // COMPARE
  if (pressed(compareButton)) {
    Serial.println("EVENT,COMPARE");
  }

  // Encoder push button
  if (pressed(encoderButton)) {
    Serial.println("EVENT,ENCODER_PRESS");
  }

  // Send parameters to laptop
  sendParameters();
}