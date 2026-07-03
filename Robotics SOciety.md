# 💡 EcoOffice: The Event-Driven Digital Twin

## 1. 📝 Problem Statement
Our boss, a "tech enthusiast," noticed that the office electricity bill is climbing because employees constantly leave lights and fans on after hours. The office operates entirely on Discord, and the boss wants a centralized, real-time monitoring system to track the state and power consumption of all electrical devices across 3 rooms (Drawing Room, Work Room 1, Work Room 2). 

The challenge is to build a unified system that provides a **Live Web Dashboard** for visual monitoring and a **Discord Bot** for quick, conversational queries, both sharing a single source of truth. 

*(**Note to Judges:** The problem statement mentions "15 devices total" based on the math of 3 rooms × 5 devices, but later text repeatedly mentions "18 devices". To solve this discrepancy elegantly, our system is **100% Config-Driven**. The backend reads from an `office_config.json` file, meaning our architecture can instantly scale to simulate 15, 18, or 500 devices without changing a single line of core logic.)*

---

## 2. 🚀 Proposed Solution
We designed an **Event-Driven Digital Twin** architecture. Instead of using inefficient polling (where the frontend constantly asks the server for updates), we use a Pub/Sub model tied directly to our database.

*   **Single Source of Truth:** PostgreSQL acts as the central brain. Both the Web Dashboard and Discord Bot read from and write to the exact same database.
*   **Config-Driven Simulation:** A background simulator reads the office layout from a JSON config and mimics human behavior (e.g., turning on lights at 9 AM, turning off fans when "virtual temperature" drops).
*   **Real-Time WebSockets:** When the simulator updates the database, the backend instantly pushes the state change via WebSockets to the Next.js frontend.
*   **AI-Powered Bot:** The Discord bot doesn't just dump raw JSON. It passes the database query results to an LLM (via Groq) to generate friendly, humanized, and sassy responses tailored to the boss's personality.
*   **Proactive Alerts:** A background worker monitors the database for anomalies (e.g., devices left on past 5 PM) and triggers Discord Webhooks to send instant visual alerts to the team's Discord channel.

---

## 3. 🛠️ Tech Stack
*   **Backend & API:** Python, FastAPI, WebSockets, SQLAlchemy (Async)
*   **Database:** PostgreSQL (Using native `LISTEN/NOTIFY` for real-time event triggering)
*   **Frontend (Dashboard):** Next.js (React), Tailwind CSS, Framer Motion (for animations), SVG (for the interactive 2D floorplan)
*   **Discord Bot:** `discord.py`, Groq API (Llama-3 for ultra-fast, free LLM inference)
*   **DevOps & Deployment:** Docker, Docker Compose
*   **Diagrams:** Excalidraw (System Architecture), Wokwi (Hardware Schematic)

---

## 4. 🔄 Workflow & Data Flow

1.  **The Simulator (The Virtual Office):** 
    *   Runs as an isolated Docker container.
    *   Reads `office_config.json` to determine how many rooms and devices exist.
    *   Every few seconds, it calculates state changes based on time-of-day and random probability.
    *   It updates the PostgreSQL `devices` table and fires a `NOTIFY` event.
2.  **The Backend (The Event Router):**
    *   Listens to the PostgreSQL `NOTIFY` channel.
    *   Upon receiving an event, it broadcasts the new device state over a WebSocket connection to all connected Web Dashboard clients.
3.  **The Web Dashboard (The Visual Twin):**
    *   Maintains a persistent WebSocket connection.
    *   Receives live updates and instantly reflects them on the UI (e.g., SVG lights glow, fan icons spin using CSS animations).
    *   Calculates live wattage and triggers local UI alerts.
4.  **The Discord Bot (The Remote Control):**
    *   Listens for commands (`!status`, `!room`, `!usage`).
    *   Queries the PostgreSQL database for the exact current state.
    *   Formats the data into a prompt and sends it to the Groq LLM API.
    *   Returns the humanized response to the Discord channel.
    *   *Bonus:* A cron-job inside the bot checks for "after-hours" anomalies and pushes proactive alerts via Discord Webhooks.