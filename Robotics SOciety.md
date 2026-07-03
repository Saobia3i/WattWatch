# 🏢 OfficeTwin: Real-Time IoT Digital Twin & Monitoring System

**Team:** [Your Team Name]  
**Hackathon:** [Hackathon Name] - Preliminary Round  
**Track:** IoT & Smart Office Automation  

---

## 📖 1. Problem Statement
Our boss, a tech-enthusiast, noticed a recurring issue: office lights and fans are frequently left running after hours, driving up electricity costs and wasting energy. 

The challenge is to build a **live monitoring system** for an office consisting of 3 rooms (Drawing Room, Work Room 1, Work Room 2) to track device states and power consumption. The system must provide visibility through two distinct interfaces:
1. A **Real-Time Web Dashboard** (featuring live metrics and visual alerts).
2. A **Discord Bot** (for quick, conversational, on-demand status checks).

**Core Constraint:** Both interfaces must read from a **single source of truth** (a shared backend) without relying on physical hardware (data must be dynamically simulated).

> **📝 A Note to the Judges on Device Count:** 
> The problem statement mentions "18 devices" in the text, but the mathematical breakdown of the rooms (3 rooms × 5 devices each) equals **15 devices**. To handle this elegantly, our system is **100% Config-Driven**. By simply updating the `office_config.json` file, our backend and simulator instantly scale to support 15, 18, or 500 devices without requiring code rewrites.

---

## 💡 2. Proposed Solution
Instead of a traditional polling-based web app, we built an **Event-Driven Digital Twin** architecture. 

*   **The Simulator (Virtual Sensors):** A Python-based async script simulates human behavior (e.g., lights turn on at 9 AM, fans turn on if virtual room temperature > 24°C). It pushes state changes directly to the database.
*   **Single Source of Truth (PostgreSQL):** We use PostgreSQL (via Supabase) as the central brain. It stores the device state and utilizes native Realtime WebSockets to instantly broadcast changes to the frontend.
*   **The Web Dashboard:** A sleek Next.js application featuring a **2D Interactive SVG Map**. When the simulator turns on a light, the SVG literally glows via CSS filters. When a fan turns on, CSS keyframes animate the blades.
*   **The AI Discord Bot:** Powered by an LLM (via Groq API for ultra-low latency), the bot doesn't just dump raw JSON. It reads the database and generates friendly, humanized responses (e.g., *"We've burned through 4.2 kWh today! Work Room 1 is the main culprit right now."*). It also proactively pushes alerts to Discord if devices are left on past 5 PM.
*   **Hardware Schematic:** We designed a representative physical circuit in **Wokwi** using an ESP32, ACS712 Current Sensors, and Relays to prove how this data would be ingested in a real-world scenario.

---

## 🛠️ 3. Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Database & Realtime** | **PostgreSQL (Supabase)** | Single source of truth + native WebSocket broadcasting. |
| **Backend API** | **Python (FastAPI)** | Handles complex logic, LLM routing, and REST endpoints. |
| **Simulator** | **Python (Asyncio)** | Generates dynamic, time-based dummy data for the devices. |
| **Web Dashboard** | **Next.js, React, Tailwind** | UI framework with glassmorphism design and real-time subscriptions. |
| **Animations** | **Framer Motion & SVG** | Powers the interactive 2D office map (glowing lights, spinning fans). |
| **Discord Bot** | **`discord.py`** | Listens for commands and triggers proactive webhook alerts. |
| **AI / LLM** | **Groq API (Llama-3)** | Generates fast, conversational, humanized bot responses. |
| **Hardware Sim** | **Wokwi** | Simulates the ESP32, Relays, and Current Sensors. |
| **Diagramming** | **Excalidraw** | Used for the High-Level System Architecture diagram. |

---

## ⚙️ 4. Workflow & Installation Guide

Follow these steps to run the entire ecosystem locally on your machine.

### Prerequisites
*   Python 3.10+
*   Node.js 18+
*   A free [Supabase](https://supabase.com/) account (for Postgres & WebSockets)
*   A free [Groq](https://console.groq.com/) API Key (for LLM)
*   A Discord Bot Token

### Step 1: Database Setup (Supabase)
1. Create a new project in Supabase.
2. Go to the SQL Editor and run the `schema.sql` file located in the `/database` folder to create the `devices` and `alerts` tables.
3. Enable **Supabase Realtime** on the `devices` table in the Database Replication settings.

### Step 2: Environment Variables
Create a `.env` file in the root directory and populate it with your credentials:
```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Discord
DISCORD_BOT_TOKEN=your_discord_token
DISCORD_ALERT_CHANNEL_ID=your_channel_id

# AI / LLM
GROQ_API_KEY=your_groq_api_key
