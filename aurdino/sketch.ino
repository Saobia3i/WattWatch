// ==========================================
// OKKHOR TECHATHON - ROOM AUTOMATION EDGE NODE
// Hardware: Arduino Uno, 2x PIR, 5x LEDs, 5x Slide Switches
// ==========================================

// --- 1. PIN DEFINITIONS ---
// Directional PIR Motion Sensors
const int pirOuter = 2; // Outer threshold (entering)
const int pirInner = 3; // Inner threshold (exiting)

// Appliance Loads (Yellow LEDs = Lights @ 15W, Blue LEDs = Fans @ 60W)
const int light1 = 4;
const int light2 = 5;
const int light3 = 6;
const int fan1   = 7;
const int fan2   = 8;

// Manual Override Slide Switches (Connected to GND via slide)
// Using INPUT_PULLUP: LOW = Switch Closed (ON), HIGH = Switch Open (OFF)
const int swLight1 = 9;
const int swLight2 = 10;
const int swLight3 = 11;
const int swFan1   = 12;
const int swFan2   = 13;

// --- 2. STATE VARIABLES ---
int peopleCount = 0;
int sequenceState = 0; // 0: Idle, 1: Entering sequence, 2: Exiting sequence
unsigned long triggerTime = 0;
const unsigned long timeout = 3000; // 3-second window to complete door crossing

// Power Rating Constants (Watts)
const int WATT_LIGHT = 15;
const int WATT_FAN   = 60;

// Track previous state to avoid flooding Serial Monitor
int lastPeopleCount = -1;
int lastPowerDraw = -1;

void setup() {
  Serial.begin(9600);
  
  // Configure Sensors & Switches
  pinMode(pirOuter, INPUT);
  pinMode(pirInner, INPUT);
  pinMode(swLight1, INPUT_PULLUP);
  pinMode(swLight2, INPUT_PULLUP);
  pinMode(swLight3, INPUT_PULLUP);
  pinMode(swFan1, INPUT_PULLUP);
  pinMode(swFan2, INPUT_PULLUP);
  
  // Configure Output Loads
  pinMode(light1, OUTPUT);
  pinMode(light2, OUTPUT);
  pinMode(light3, OUTPUT);
  pinMode(fan1, OUTPUT);
  pinMode(fan2, OUTPUT);
  
  // HACKATHON REQUIREMENT: Initialize ALL loads HIGH (ON) by default
  digitalWrite(light1, HIGH);
  digitalWrite(light2, HIGH);
  digitalWrite(light3, HIGH);
  digitalWrite(fan1, HIGH);
  digitalWrite(fan2, HIGH);
  
  Serial.println("{\"status\": \"SYSTEM_READY\", \"mode\": \"DEFAULT_HIGH\"}");
  updateLoads();
}

void loop() {
  int outerState = digitalRead(pirOuter);
  int innerState = digitalRead(pirInner);
  unsigned long currentTime = millis();

  // Reset PIR sequence if someone steps in but turns around (timeout expires)
  if (sequenceState != 0 && (currentTime - triggerTime > timeout)) {
    sequenceState = 0;
  }
  
  // Step 1: Detect which sensor is triggered first
  if (sequenceState == 0) {
    if (outerState == HIGH && innerState == LOW) { 
      sequenceState = 1; // Possible Entry
      triggerTime = currentTime; 
    }
    else if (innerState == HIGH && outerState == LOW) { 
      sequenceState = 2; // Possible Exit
      triggerTime = currentTime; 
    }
  }
  // Step 2: Confirm sequence completion
  else if (sequenceState == 1 && innerState == HIGH) {
    peopleCount++; 
    sequenceState = 0; 
    updateLoads(); 
    delay(1000); // Debounce delay so person clears doorway
  } 
  else if (sequenceState == 2 && outerState == HIGH) {
    if (peopleCount > 0) peopleCount--; 
    sequenceState = 0; 
    updateLoads(); 
    delay(1000); // Debounce delay
  }
  
  // Continuously check manual switches so overrides respond instantly
  updateLoads();
  delay(50); // Short stability delay
}

void updateLoads() {
  // Hybrid Control Logic:
  // A device is ON if (Room is Occupied) OR (Its Manual Switch is flipped ON)
  bool isOccupied = (peopleCount > 0);

  // Note: digitalRead() == LOW means the slide switch is pulled to Ground (Flipped ON)
  bool l1State = (digitalRead(swLight1) == LOW);
  bool l2State = (digitalRead(swLight2) == LOW);
  bool l3State = (digitalRead(swLight3) == LOW);
  bool f1State = (digitalRead(swFan1) == LOW);
  bool f2State = (digitalRead(swFan2) == LOW);

  // Apply physical voltage to pins
  digitalWrite(light1, l1State ? HIGH : LOW);
  digitalWrite(light2, l2State ? HIGH : LOW);
  digitalWrite(light3, l3State ? HIGH : LOW);
  digitalWrite(fan1,   f1State ? HIGH : LOW);
  digitalWrite(fan2,   f2State ? HIGH : LOW);

  // Calculate Real-Time Power Draw
  int activePower = 0;
  if (l1State) activePower += WATT_LIGHT;
  if (l2State) activePower += WATT_LIGHT;
  if (l3State) activePower += WATT_LIGHT;
  if (f1State) activePower += WATT_FAN;
  if (f2State) activePower += WATT_FAN;

  // Print JSON Telemetry to Serial Monitor whenever state changes
  if (peopleCount != lastPeopleCount || activePower != lastPowerDraw) {
    Serial.print("{\"room\": \"Work Room 1\", ");
    Serial.print("\"occupancy\": ");
    Serial.print(peopleCount);
    Serial.print(", \"activeWatts\": ");
    Serial.print(activePower);
    Serial.print(", \"devices\": {\"light1\": ");
    Serial.print(l1State ? "true" : "false");
    Serial.print(", \"light2\": ");
    Serial.print(l2State ? "true" : "false");
    Serial.print(", \"light3\": ");
    Serial.print(l3State ? "true" : "false");
    Serial.print(", \"fan1\": ");
    Serial.print(f1State ? "true" : "false");
    Serial.print(", \"fan2\": ");
    Serial.print(f2State ? "true" : "false");
    Serial.println("}}");

    lastPeopleCount = peopleCount;
    lastPowerDraw = activePower;
  }
}