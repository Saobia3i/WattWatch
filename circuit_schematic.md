# 🔌 Hardware Circuit Schematic & Pin Mapping Specification

This document details the hardware design, electrical wiring schematic, pin mapping, and sensor reasoning for implementing a physical deployment of the **WattWatch** smart office system.

---

## ⚡ 1. Circuit Architecture Overview

In a physical deployment, each room's device set is controlled and monitored by an **ESP32 Microcontroller**. The ESP32:
1. **Controls** the power to the fans and lights using a **Relay Module** (acting as digital switches).
2. **Senses** the real-time electrical current draw using an **ACS712 Current Sensor** wired in series with the load.

To maintain scalability, a representative circuit for one room (containing 2 fans and 3 lights) is detailed below. The same module can be duplicated for all three rooms in the office.

---

## 🛠️ 2. ESP32 Pin Mapping & Connections

| ESP32 Pin | Component | Description | Pin Mode / Type |
| :--- | :--- | :--- | :--- |
| **GND** | Ground Rail | Common ground for all sensors and relay module | Ground |
| **5V / VIN**| VCC Rail | Power supply for Relay board & ACS712 sensors | Power Output (5V) |
| **GPIO 13** | Relay 1 (Fan 1) | Triggers the magnetic coil to toggle Fan 1 power | Digital Output |
| **GPIO 12** | Relay 2 (Fan 2) | Triggers the magnetic coil to toggle Fan 2 power | Digital Output |
| **GPIO 14** | Relay 3 (Light 1)| Triggers the magnetic coil to toggle Light 1 power| Digital Output |
| **GPIO 27** | Relay 4 (Light 2)| Triggers the magnetic coil to toggle Light 2 power| Digital Output |
| **GPIO 26** | Relay 5 (Light 3)| Triggers the magnetic coil to toggle Light 3 power| Digital Output |
| **GPIO 34** | ACS712 Sensor 1 | Reads analog voltage representing Fan 1 current | Analog Input (ADC1_CH6)|
| **GPIO 35** | ACS712 Sensor 2 | Reads analog voltage representing Fan 2 current | Analog Input (ADC1_CH7)|
| **GPIO 36** | ACS712 Sensor 3 | Reads analog voltage representing Light 1 current| Analog Input (ADC1_CH0)|
| **GPIO 39** | ACS712 Sensor 4 | Reads analog voltage representing Light 2 current| Analog Input (ADC1_CH3)|
| **GPIO 32** | ACS712 Sensor 5 | Reads analog voltage representing Light 3 current| Analog Input (ADC1_CH4)|

---

## 📋 3. Detailed Component Connection List

### 1. DC Control Connections (Low Voltage)
- **Power**: Connect ESP32 `VIN` (5V) to the `VCC` pin of the Relay Board and the `VCC` pin of all five ACS712 sensors.
- **Ground**: Connect ESP32 `GND` to the `GND` pin of the Relay Board and the `GND` pin of all five ACS712 sensors.
- **Relay Controls**:
  - Connect ESP32 `GPIO 13` to Relay Input 1.
  - Connect ESP32 `GPIO 12` to Relay Input 2.
  - Connect ESP32 `GPIO 14` to Relay Input 3.
  - Connect ESP32 `GPIO 27` to Relay Input 4.
  - Connect ESP32 `GPIO 26` to Relay Input 5.
- **Sensor Outputs (Analog)**:
  - Connect ACS712-1 `OUT` to ESP32 `GPIO 34`.
  - Connect ACS712-2 `OUT` to ESP32 `GPIO 35`.
  - Connect ACS712-3 `OUT` to ESP32 `GPIO 36`.
  - Connect ACS712-4 `OUT` to ESP32 `GPIO 39`.
  - Connect ACS712-5 `OUT` to ESP32 `GPIO 32`.

### 2. AC Load Connections (Mains Voltage - 220V AC)
- **Mains Line (Phase)**: Connect the 220V AC Phase line to the **Common (COM)** terminal of all five Relays in parallel.
- **Relay to Sensor (Series)**:
  - Connect Relay 1 **Normally Open (NO)** terminal to ACS712-1 Terminal 1.
  - Connect Relay 2 **Normally Open (NO)** terminal to ACS712-2 Terminal 1.
  - Connect Relay 3 **Normally Open (NO)** terminal to ACS712-3 Terminal 1.
  - Connect Relay 4 **Normally Open (NO)** terminal to ACS712-4 Terminal 1.
  - Connect Relay 5 **Normally Open (NO)** terminal to ACS712-5 Terminal 1.
- **Sensor to Load (Series)**:
  - Connect ACS712-1 Terminal 2 to Fan 1 Line input.
  - Connect ACS712-2 Terminal 2 to Fan 2 Line input.
  - Connect ACS712-3 Terminal 2 to Light 1 Line input.
  - Connect ACS712-4 Terminal 2 to Light 2 Line input.
  - Connect ACS712-5 Terminal 2 to Light 3 Line input.
- **Mains Neutral**: Connect the 220V AC Neutral line to the Neutral input of all five devices (fans and lights).

---

## 🎨 4. ASCII Wiring Diagram Representation

```
                    +-------------------+
                    |    ESP32 Board    |
                    |                   |
                    |   5V/VIN    GND   |
                    +-----+--------+----+
                          |        |
    +---------------------+        +--------------------+
    | VCC                                               | GND
    |                                                   |
    |   +--------------------------+                    |
    +---+ Relay Board (5 Channels) |                    |
    |   |                          |                    |
    |   | IN1 IN2 IN3 IN4 IN5      |                    |
    |   +--^---^---^---^---^-------+                    |
    |      |   |   |   |   |                            |
    |      |   |   |   |   +--- GPIO 26                 |
    |      |   |   |   +------- GPIO 27                 |
    |      |   |   +----------- GPIO 14                 |
    |      |   +--------------- GPIO 12                 |
    |      +------------------- GPIO 13                 |
    |                                                   |
    |   +--------------------------+                    |
    +---+ ACS712 Current Sensors   |                    |
        |                          |                    |
        | OUT1 OUT2 OUT3 OUT4 OUT5 |                    |
        +--+----+----+----+----+---+                    |
           |    |    |    |    |                        |
           |    |    |    |    +--- GPIO 32             |
           |    |    |    +-------- GPIO 39             |
           |    |    +------------- GPIO 36             |
           |    +------------------ GPIO 35             |
           +----------------------- GPIO 34             |
                                                        |
 220V AC                                                |
 Phase ----------[Relay COM]                            |
                     |                                  |
               [Relay NO]                               |
                     |                                  |
               [ACS712 In]                              |
                     |                                  |
               [ACS712 Out]                             |
                     |                                  |
                   [LOAD (Light/Fan)]                   |
                     |                                  |
 Neutral ------------+----------------------------------+
```

---

## 🧠 5. Electrical Reasoning & Theory

### 1. Actuation (Relay Switches)
A relay is an electromagnetic switch. When the ESP32 outputs a digital `HIGH` (3.3V) on a control pin (e.g. GPIO 13), it triggers a transistor on the relay board that draws current through the relay's electromagnetic coil. This coil pulls the internal metallic switch from the **NC (Normally Closed)** contact to the **NO (Normally Open)** contact, completing the high-voltage AC circuit and turning the device ON.

### 2. Sensing (ACS712 Current Sensors)
The ACS712 uses a Hall-effect sensor to measure current.
- **Series Wiring**: The AC load line runs through the internal copper conduction path of the ACS712 chip. As current passes through, it generates a proportional magnetic field.
- **Hall Effect Transduction**: An integrated Hall IC converts the magnetic field into an analog output voltage.
- **Calibration**: The ACS712 outputs a baseline voltage of $V_{CC}/2$ (typically 2.5V) at $0\text{ A}$ current. The output voltage changes linearly with current (e.g. $185\text{ mV/A}$ for the 5A model).
- **Calculation**: By reading the analog voltage from the ADC pin, the ESP32 calculates the Root-Mean-Square (RMS) current ($I_{\text{RMS}}$). Since the mains voltage ($V_{\text{AC}}$) is known (typically $220\text{ V}$), the power draw in Watts is calculated:
  $$\text{Power (Watts)} = V_{\text{AC}} \times I_{\text{RMS}} \times \text{Power Factor}$$

---

## 🛡️ 6. Safety & Best Engineering Practices

> [!WARNING]
> High Voltage AC (220V) poses a severe risk of electric shock and fire if mishandled.
> 1. **Optocoupler Isolation**: Always use a relay board with built-in optoisolators. This electrically isolates the low-voltage ESP32 circuit from high-voltage AC spikes.
> 2. **Common Ground**: Ensure a solid, common ground connection for all low-voltage logic components to prevent signal drift and sensor calibration errors.
> 3. **Physical Isolation**: Keep AC wiring physically separated from DC logic wiring on your breadboard or PCB enclosure. Use high-quality terminal blocks and insulated enclosures.
