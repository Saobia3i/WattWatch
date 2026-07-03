# 🗄️ Database Requirements Specification (PostgreSQL / Supabase)

This document outlines the database schema, table structures, and seed data required for the **WattWatch** hackathon project. It acts as the shared single source of truth for the Next.js Dashboard, the Python Simulator, and the Discord Bot.

Since this database is built on **PostgreSQL (or Supabase)**, it uses native database features like `BOOLEAN`, `UUID`, and `TIMESTAMPTZ` (time-zone-aware timestamps) to ensure data integrity and automatic real-time syncs.

---

## 1. Schema Diagram & Relationships

```
┌───────────┐         ┌───────────┐         ┌────────────────┐
│   rooms   │ 1 ─── 1 │  sensors  │         │   telemetry    │
└─────┬─────┘         └───────────┘         └───────┬────────┘
      │ 1                                           │ N
      └─── N ┌───────────┐                          │
             │  devices  │ 1 ───────────────────────┘
             └─────┬─────┘
                   │ 1
                   └─── N ┌───────────┐
                          │  alerts   │
                          └───────────┘
```

---

## 2. Table Specifications

### Table 1: `rooms`
Physical locations inside the office.
* **`id`** (`VARCHAR` / PRIMARY KEY): Room identifier (e.g., `'drawing'`, `'work1'`, `'work2'`).
* **`name`** (`VARCHAR`): Human-readable name (e.g., `'Drawing Room'`, `'Work Room 1'`).
* **`max_capacity`** (`INTEGER`): Maximum capacity configuration.

### Table 2: `devices`
Real-time state of all fans and lights.
* **`id`** (`VARCHAR` / PRIMARY KEY): Unique device ID (e.g., `'drawing-fan-1'`).
* **`room_id`** (`VARCHAR` / FOREIGN KEY $\rightarrow$ `rooms.id`): Location of the device.
* **`name`** (`VARCHAR`): Device name (e.g., `'Fan 1'`, `'Light 3'`).
* **`type`** (`VARCHAR`): `'fan'` or `'light'`.
* **`is_on`** (`BOOLEAN`): `true` if running, `false` if off.
* **`rated_power_watts`** (`INTEGER`): Electrical load (e.g., `60` for fans, `15` for lights).
* **`last_changed`** (`TIMESTAMPTZ`): Timestamp of last toggle. Used to track $>2$ hours continuous runs.

### Table 3: `room_sensors`
Occupancy states computed by triggers.
* **`room_id`** (`VARCHAR` / PRIMARY KEY / FOREIGN KEY $\rightarrow$ `rooms.id`).
* **`is_occupied`** (`BOOLEAN`): `true` if people are inside, `false` if empty.
* **`enter_count`** (`INTEGER`): Total entries.
* **`exit_count`** (`INTEGER`): Total exits.
* **`last_motion_at`** (`TIMESTAMPTZ`): Timestamp of last occupancy transition.

### Table 4: `alerts`
Anomaly warnings logged by the simulator.
* **`id`** (`VARCHAR` / PRIMARY KEY): Unique alert ID.
* **`room_id`** (`VARCHAR` / FOREIGN KEY $\rightarrow$ `rooms.id`): Location.
* **`severity`** (`VARCHAR`): `'warning'` or `'critical'`.
* **`message`** (`TEXT`): Text shown on dashboard and Discord.
* **`is_active`** (`BOOLEAN`): `true` if active/unresolved, `false` if cleared.
* **`triggered_at`** (`TIMESTAMPTZ`): Timestamp of creation.

### Table 5: `device_telemetry`
Historical logs of power draw over time. Used to calculate cumulative **kWh** usage.
* **`id`** (`BIGSERIAL` / PRIMARY KEY): Auto-incrementing ID.
* **`device_id`** (`VARCHAR` / FOREIGN KEY $\rightarrow$ `devices.id`).
* **`is_on`** (`BOOLEAN`): State at logging moment.
* **`power_draw_watts`** (`INTEGER`): Wattage draw.
* **`recorded_at`** (`TIMESTAMPTZ`): Timestamp of log entry.

---

## 3. SQL DDL Scripts (Create Tables)

Copy-paste these scripts into your PostgreSQL query tool (like pgAdmin or Supabase SQL Editor):

```sql
-- Create Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    max_capacity INTEGER DEFAULT 10
);

-- Create Devices Table
CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(50) PRIMARY KEY,
    room_id VARCHAR(50) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('fan', 'light')) NOT NULL,
    is_on BOOLEAN DEFAULT FALSE,
    rated_power_watts INTEGER NOT NULL,
    last_changed TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Room Sensors Table
CREATE TABLE IF NOT EXISTS room_sensors (
    room_id VARCHAR(50) PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
    is_occupied BOOLEAN DEFAULT FALSE,
    enter_count INTEGER DEFAULT 0,
    exit_count INTEGER DEFAULT 0,
    last_motion_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(50) PRIMARY KEY,
    room_id VARCHAR(50) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    severity VARCHAR(20) CHECK (severity IN ('warning', 'critical')) NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Device Telemetry Table
CREATE TABLE IF NOT EXISTS device_telemetry (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    is_on BOOLEAN NOT NULL,
    power_draw_watts INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Database Seed Script (Initial Values)

Run this seed query to populate the 3 rooms and exactly 15 devices (2 fans, 3 lights per room):

```sql
-- Seed Rooms
INSERT INTO rooms (id, name, max_capacity) VALUES 
('drawing', 'Drawing Room', 8),
('work1', 'Work Room 1', 12),
('work2', 'Work Room 2', 12)
ON CONFLICT (id) DO NOTHING;

-- Seed Sensors
INSERT INTO room_sensors (room_id, is_occupied, enter_count, exit_count, last_motion_at) VALUES
('drawing', TRUE, 1, 0, NOW()),
('work1', TRUE, 2, 0, NOW()),
('work2', TRUE, 2, 0, NOW())
ON CONFLICT (room_id) DO NOTHING;

-- Seed Devices (15 total: 2 fans, 3 lights per room)
-- Drawing Room
INSERT INTO devices (id, room_id, name, type, is_on, rated_power_watts, last_changed) VALUES
('drawing-fan-1', 'drawing', 'Fan 1', 'fan', FALSE, 60, NOW()),
('drawing-fan-2', 'drawing', 'Fan 2', 'fan', FALSE, 60, NOW()),
('drawing-light-1', 'drawing', 'Light 1', 'light', FALSE, 15, NOW()),
('drawing-light-2', 'drawing', 'Light 2', 'light', FALSE, 15, NOW()),
('drawing-light-3', 'drawing', 'Light 3', 'light', FALSE, 15, NOW())
ON CONFLICT (id) DO NOTHING;

-- Work Room 1
INSERT INTO devices (id, room_id, name, type, is_on, rated_power_watts, last_changed) VALUES
('work1-fan-1', 'work1', 'Fan 1', 'fan', FALSE, 60, NOW()),
('work1-fan-2', 'work1', 'Fan 2', 'fan', FALSE, 60, NOW()),
('work1-light-1', 'work1', 'Light 1', 'light', FALSE, 15, NOW()),
('work1-light-2', 'work1', 'Light 2', 'light', FALSE, 15, NOW()),
('work1-light-3', 'work1', 'Light 3', 'light', FALSE, 15, NOW())
ON CONFLICT (id) DO NOTHING;

-- Work Room 2
INSERT INTO devices (id, room_id, name, type, is_on, rated_power_watts, last_changed) VALUES
('work2-fan-1', 'work2', 'Fan 1', 'fan', FALSE, 60, NOW()),
('work2-fan-2', 'work2', 'Fan 2', 'fan', FALSE, 60, NOW()),
('work2-light-1', 'work2', 'Light 1', 'light', FALSE, 15, NOW()),
('work2-light-2', 'work2', 'Light 2', 'light', FALSE, 15, NOW()),
('work2-light-3', 'work2', 'Light 3', 'light', FALSE, 15, NOW())
ON CONFLICT (id) DO NOTHING;
```
