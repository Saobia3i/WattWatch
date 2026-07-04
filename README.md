# ⚡ WattWatch: Real-Time IoT Digital Twin & Smart Office Console

**WattWatch** is a production-grade, event-driven smart office monitoring system designed to prevent electricity waste. It features a real-time web dashboard and a conversational AI Discord bot that share a single source of truth backed by a local SQLite database.

---

## 🗺️ 1. High-Level System Diagram

Below is the event-driven data flow of the system. Toggling devices on the dashboard updates the SQLite database and broadcasts state changes to all connected SSE clients, including the Discord Bot.

![WattWatch System Architecture Diagram](/public/system_diagram.svg)

---

## 🔌 2. Hardware / Circuit Schematic

We have designed a representative physical circuit using an **ESP32**, **Relays**, and **ACS712 Current Sensors** to prove how the office devices would be wired and monitored in a real-world deployment.

👉 Read the full [Circuit Schematic & Pin Mapping Specification](file:///e:/vs%20code%20projects/WattWatch/WattWatch/circuit_schematic.md) for connections, diagrams, and electrical theory.

---

## 👥 3. Mandatory Dummy Dataset (Registered Office Occupants)

The system manages the following occupant directory in the SQLite database, exposing them via the API and bot command (`!occupants`):

```json
[
  {
    "name": "Nafisa Rahman",
    "email": "nafisa.rahman@yahoo.com",
    "phone": "+8801812345678"
  },
  {
    "name": "Tanvir Hossain",
    "email": "tanvir.hossain@yahoo.com",
    "phone": "+8801912345678"
  }
]
```

---

## 🌟 4. Core Features

### 🖥️ Web Dashboard
- **2D Office floorplan Blueprint**: Sleek top-view vector map featuring glowing light filters when active and spinning fan animations.
- **Live Device Status Panel**: Visual control deck listing all 15 devices grouped by room with instantaneous controls.
- **Power Consumption Meter**: Real-time total wattage draw, per-room breakdown, and cumulative kWh tracking.
- **Active Alerts Panel**: Real-time alerts displaying anomalies (e.g. devices left on after hours or unoccupied rooms wasting energy).
- **SSE Broadcast Engine**: Live telemetry updates streamed over Server-Sent Events (SSE) with no page refresh.

### 🤖 Discord Bot
- **!status**: Summarizes active lights/fans and occupancy counts for each room.
- **!room <name>**: Returns device statuses and current occupants for a specific room.
- **!usage**: Reports current active load (W) and today's accumulated kWh energy consumption.
- **!occupants**: Lists registered members from the dummy dataset.
- **Proactive SSE Alerting**: Hooks into the backend's SSE stream and broadcasts urgent anomaly notifications to a specific channel.
- **Conversational AI**: Integrates optional LLM capabilities (Gemini / Groq) to generate friendly responses.

---

## ⚙️ 5. Installation & Setup Guide

Follow these steps to run the entire system locally:

### Step 1: Clone and Install Dependencies
```bash
# Install Web Dashboard dependencies
npm install

# Install Discord Bot dependencies
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```
Ensure you provide a `DISCORD_BOT_TOKEN`, `DISCORD_ALERT_CHANNEL_ID` (for alerts), and optionally a `GEMINI_API_KEY` (for AI replies).

### Step 3: Run the Web Dashboard Backend
```bash
# Runs dev mode (initializes wattwatch.db automatically)
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the console.

### Step 4: Run the Python Simulator
The simulator generates time-based activities and updates room occupancy:
```bash
python simulator.py
```

### Step 5: Run the Discord Bot
```bash
python discord_bot.py
```
Type `!status` or `!usage` inside your Discord server to test!
