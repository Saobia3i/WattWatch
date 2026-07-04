# 🏢 Project Context: The Story Behind WattWatch

This document presents the backstory, origin motivation, and project context of **WattWatch** for the hackathon judges.

---

## 💡 1. Origin Story: "The Boss's Big Idea"

We work at a small, fast-paced office where everything happens on Discord — daily standups, memes, client updates, and lunch plans. 

However, we had one recurring problem: **people kept leaving the lights and fans running when they headed home.** The office electricity bill kept climbing, and nobody noticed until it was too late.

One morning, our boss—a self-proclaimed "tech enthusiast" with just enough knowledge to be dangerous and a deep love for out-of-the-box ideas—burst in with a brainwave:

> *"What if I could see every light and fan in the office on a live dashboard? And check how much power we're burning? And ask a bot about it right from Discord?"*

That burst of inspiration is what birthed **WattWatch**. We designed a unified IoT digital twin console that satisfies our boss's dream while implementing a robust, production-ready system architecture.

---

## 🎯 2. Core Requirements & Mapping

Here is how WattWatch solves the office challenge and matches all specified hackathon requirements:

### 1. The Office Setup (3 Rooms, 15 Devices)
*   **Drawing Room**: 2 Fans + 3 Lights
*   **Work Room 1**: 2 Fans + 3 Lights
*   **Work Room 2**: 2 Fans + 3 Lights
*   *Implementation*: The web dashboard features a realistic **2D office blueprint** mapping all 15 devices, complete with CSS spinning animations for active fans and glowing radial filters for active lights.

### 2. Live Power Consumption Telemetry
*   *Requirement*: Monitor active load (Watts) and today's accumulated energy usage (kWh).
*   *Implementation*: [/api/usage](file:///e:/vs%20code%20projects/WattWatch/WattWatch/app/api/usage/route.ts) reads active devices from SQLite and computes live draw in real-time. A server-side background simulation loop increments the cumulative kWh draw every 3 seconds.

### 3. Waste Detection Anomaly Alerts
*   *Requirement*: Set alerts for:
    1. Devices left active outside 9 AM - 5 PM office hours.
    2. Any device running continuously for more than 2 hours.
    3. Empty rooms wasting energy (detected via motion sensors).
*   *Implementation*: The backend automatically validates states against these rules and saves active warnings into SQLite, streaming them instantly to the client console and the Discord bot.

### 4. Single Source of Truth
*   *Requirement*: Web Dashboard and Discord Bot must read from the same database.
*   *Implementation*: Both the Next.js web application and the Python Discord Bot query a local [wattwatch.db](file:///e:/vs%20code%20projects/WattWatch/WattWatch/wattwatch.db) (SQLite) database, ensuring zero sync lag.

### 5. AI-Powered Discord Bot
*   *Requirement*: Command-line query system with conversational generative responses.
*   *Implementation*: [discord_bot.py](file:///e:/vs%20code%20projects/WattWatch/WattWatch/discord_bot.py) listens to commands (`!status`, `!usage`, `!room`, `!occupants`) and calls the Gemini 2.5 Flash API to phrase telemetry metrics in natural, friendly language.

---

## 🏗️ 3. Codespace Architecture Summary

*   **Frontend Console**: Next.js (React) + Vanilla CSS (Custom Glassmorphic styles and SVG layouts).
*   **Shared Database**: SQLite (`sqlite3` + `sqlite` in Node).
*   **Live Stream Engine**: HTTP Server-Sent Events (SSE) broadcasting database writes to subscribers.
*   **Python Simulator**: `simulator.py` simulates occupant motion telemetry.
*   **Python Discord Bot**: `discord_bot.py` connecting to Discord's gateway, listening to commands, and pushing live SSE warning embeds to the office channel.
