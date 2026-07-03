# 🗄️ Database Schema (PostgreSQL / Supabase)

This schema is designed to be the "Single Source of Truth" for the Web Dashboard, Discord Bot, and Python Simulator. 

> **Note to Judges:** The problem statement contained a discrepancy regarding the total number of devices (15 mathematically vs. 18 in text). This schema uses relational mapping (`rooms` -> `devices`), allowing the system to instantly scale to any number of rooms or devices via configuration without altering the database structure.

## 1. `rooms` Table
Stores the physical locations in the office.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Unique identifier for the room. |
| `name` | `varchar` | e.g., 'Drawing Room', 'Work Room 1'. |
| `max_capacity` | `int` | Used to cap motion sensor drift (e.g., max 10 people). |
| `created_at` | `timestamptz` | Auto-generated. |

## 2. `devices` Table (The Core State)
Represents the current, real-time state of every light and fan. **Updates here trigger Supabase Realtime WebSockets to the frontend.**

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Unique identifier for the device. |
| `room_id` | `uuid` (FK) | Links to the `rooms` table. |
| `name` | `varchar` | e.g., 'Fan 1', 'Light 3'. |
| `type` | `enum` | 'light' or 'fan'. |
| `is_on` | `boolean` | Current status (True = ON, False = OFF). |
| `rated_power_watts`| `int` | e.g., 60W for fan, 15W for light. |
| `last_changed` | `timestamptz` | **Required by prompt.** Timestamp of the last state change. Used to calculate ">2 hours continuous" alerts. |

## 3. `room_sensors` Table (Motion & Occupancy)
Handles your dual motion-detector logic. The simulator updates `enter_trigger_count` and `exit_trigger_count`, but the backend relies on `is_occupied` for alerts.

| Column | Type | Description |
| :--- | :--- | :--- |
| `room_id` | `uuid` (PK/FK)| 1-to-1 relationship with `rooms`. |
| `enter_trigger_count`| `int` | Raw count from Sensor 1 (Entry). |
| `exit_trigger_count` | `int` | Raw count from Sensor 2 (Exit). |
| `is_occupied` | `boolean` | **Backend calculated.** True if people are inside. |
| `last_motion_at` | `timestamptz` | Timestamp of the last motion detected. |

## 4. `device_telemetry` Table (For kWh Calculation)
To fulfill the `!usage` command ("Today's estimated usage: 4.2 kWh"), the backend needs to know *how long* a device was on. The simulator appends a row here every time a device changes state or at regular intervals.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigserial` (PK)| Auto-incrementing ID. |
| `device_id` | `uuid` (FK) | Links to `devices`. |
| `is_on` | `boolean` | State during this log entry. |
| `power_draw_watts` | `int` | Power being drawn at this exact moment. |
| `recorded_at` | `timestamptz` | When this telemetry point was logged. |

## 5. `alerts` Table
Stores triggered anomalies for the Web Dashboard's "Active Alerts Panel" and the Discord Bot's proactive warnings.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Unique alert ID. |
| `room_id` | `uuid` (FK) | Where the alert happened. |
| `device_id` | `uuid` (FK) | Specific device (nullable if it's a room-wide alert). |
| `alert_type` | `varchar` | e.g., 'AFTER_HOURS', 'EMPTY_ROOM_ON', 'CONTINUOUS_RUN'. |
| `message` | `text` | The humanized message sent to Discord/UI. |
| `is_active` | `boolean` | True if unresolved, False if fixed. |
| `triggered_at` | `timestamptz` | When the alert fired. |

---

## ⚙️ Backend Logic Mapping (How to use this schema)

### 1. Handling the Motion Sensors (Drift Prevention)
When the simulator sends an enter/exit trigger:
```sql
-- Backend logic to update occupancy safely
UPDATE room_sensors 
SET 
  enter_trigger_count = enter_trigger_count + NEW_ENTER_VAL,
  exit_trigger_count = exit_trigger_count + NEW_EXIT_VAL,
  is_occupied = CASE 
      WHEN (enter_trigger_count - exit_trigger_count) > 0 THEN true 
      ELSE false 
  END,
  last_motion_at = NOW()
WHERE room_id = 'target_room';
```
*Safety Net:* Run a Cron job at 2:00 AM daily to reset `enter_trigger_count` and `exit_trigger_count` to `0` to prevent integer overflow and permanent drift.

### 2. Calculating kWh for the `!usage` Command
The Discord bot queries the `device_telemetry` table to calculate energy used today:
```sql
-- Calculates total Watt-hours, then divides by 1000 for kWh
SELECT 
  SUM(power_draw_watts * EXTRACT(EPOCH FROM (LEAD(recorded_at) OVER(PARTITION BY device_id ORDER BY recorded_at) - recorded_at)) / 3600) / 1000 as total_kwh
FROM device_telemetry
WHERE recorded_at >= CURRENT_DATE AND is_on = true;
```

### 3. Triggering the "> 2 Hours" Alert
The backend runs a check every 5 minutes:
```sql
SELECT d.name, r.name as room_name 
FROM devices d
JOIN rooms r ON d.room_id = r.id
WHERE d.is_on = true 
  AND d.last_changed < NOW() - INTERVAL '2 hours';
```
If this query returns results, the backend inserts a row into the `alerts` table and fires a Discord Webhook.