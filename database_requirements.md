# 🗄️ Database Requirements Specification (SQLite)

This document outlines the SQLite schema, table structures, and seed data required for the **WattWatch** hackathon project. It acts as the shared single source of truth for the Next.js Dashboard, the Python Simulator, and the Discord Bot.

Since SQLite is file-based, it stores all tables in a single file (e.g., `wattwatch.db`). SQLite does not have native UUID, Boolean, or Timestamp types. Instead, we use:
- **Booleans**: Stored as `INTEGER` (`0` for `false`, `1` for `true`).
- **Timestamps**: Stored as `TEXT` in ISO-8601 string format (e.g., `'2026-07-04T02:00:00Z'`).
- **IDs**: Stored as `TEXT`.

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
* **`id`** (`TEXT` / PRIMARY KEY): Room identifier (e.g., `'drawing'`, `'work1'`, `'work2'`).
* **`name`** (`TEXT`): Human-readable name (e.g., `'Drawing Room'`, `'Work Room 1'`).
* **`max_capacity`** (`INTEGER`): Maximum capacity configuration.

### Table 2: `devices`
Real-time state of all fans and lights.
* **`id`** (`TEXT` / PRIMARY KEY): Unique device ID (e.g., `'drawing-fan-1'`).
* **`room_id`** (`TEXT` / FOREIGN KEY $\rightarrow$ `rooms.id`): Location of the device.
* **`name`** (`TEXT`): Device name (e.g., `'Fan 1'`, `'Light 3'`).
* **`type`** (`TEXT`): `'fan'` or `'light'`.
* **`is_on`** (`INTEGER`): `1` if the device is running, `0` if off.
* **`rated_power_watts`** (`INTEGER`): Electrical load (e.g., `60` for fans, `15` for lights).
* **`last_changed`** (`TEXT`): ISO-8601 timestamp of last toggle (e.g., `'2026-07-04T02:00:00Z'`). Used for continuous overrun tracking.

### Table 3: `room_sensors`
Occupancy states computed by entry/exit triggers.
* **`room_id`** (`TEXT` / PRIMARY KEY / FOREIGN KEY $\rightarrow$ `rooms.id`).
* **`is_occupied`** (`INTEGER`): `1` if people are inside, `0` if empty.
* **`enter_count`** (`INTEGER`): Total entries.
* **`exit_count`** (`INTEGER`): Total exits.
* **`last_motion_at`** (`TEXT`): ISO timestamp of last transition.

### Table 4: `alerts`
Anomaly warnings logged by the simulator.
* **`id`** (`TEXT` / PRIMARY KEY): Unique alert ID.
* **`room_id`** (`TEXT` / FOREIGN KEY $\rightarrow$ `rooms.id`): Location.
* **`severity`** (`TEXT`): `'warning'` or `'critical'`.
* **`message`** (`TEXT`): Text shown on dashboard and Discord.
* **`is_active`** (`INTEGER`): `1` if active/unresolved, `0` if cleared.
* **`triggered_at`** (`TEXT`): Timestamp of creation.

### Table 5: `device_telemetry`
Historical logs of power draw over time. Used to calculate cumulative **kWh** usage.
* **`id`** (`INTEGER` / PRIMARY KEY AUTOINCREMENT).
* **`device_id`** (`TEXT` / FOREIGN KEY $\rightarrow$ `devices.id`).
* **`is_on`** (`INTEGER`): State at logging moment (`0` or `1`).
* **`power_draw_watts`** (`INTEGER`): Wattage draw.
* **`recorded_at`** (`TEXT`): ISO-8601 timestamp.

---

## 3. SQL DDL Scripts (Create Tables)

Copy-paste these scripts into your SQLite database manager:

```sql
-- Enable foreign key support in SQLite
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    max_capacity INTEGER DEFAULT 10
);

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('fan', 'light')) NOT NULL,
    is_on INTEGER CHECK(is_on IN (0, 1)) DEFAULT 0,
    rated_power_watts INTEGER NOT NULL,
    last_changed TEXT NOT NULL,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room_sensors (
    room_id TEXT PRIMARY KEY,
    is_occupied INTEGER CHECK(is_occupied IN (0, 1)) DEFAULT 0,
    enter_count INTEGER DEFAULT 0,
    exit_count INTEGER DEFAULT 0,
    last_motion_at TEXT NOT NULL,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    severity TEXT CHECK(severity IN ('warning', 'critical')) NOT NULL,
    message TEXT NOT NULL,
    is_active INTEGER CHECK(is_active IN (0, 1)) DEFAULT 1,
    triggered_at TEXT NOT NULL,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS device_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    is_on INTEGER CHECK(is_on IN (0, 1)) NOT NULL,
    power_draw_watts INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);
```

---

## 4. Database Seed Script (Initial Values)

Run these inserts to populate the 3 rooms and exactly 15 devices (2 fans, 3 lights per room):

```sql
-- Seed Rooms
INSERT OR IGNORE INTO rooms (id, name, max_capacity) VALUES 
('drawing', 'Drawing Room', 8),
('work1', 'Work Room 1', 12),
('work2', 'Work Room 2', 12);

-- Seed Sensors
INSERT OR IGNORE INTO room_sensors (room_id, is_occupied, enter_count, exit_count, last_motion_at) VALUES
('drawing', 1, 1, 0, datetime('now')),
('work1', 1, 2, 0, datetime('now')),
('work2', 1, 2, 0, datetime('now'));

-- Seed Devices (15 total: 2 fans, 3 lights per room)
-- Drawing Room
INSERT OR IGNORE INTO devices (id, room_id, name, type, is_on, rated_power_watts, last_changed) VALUES
('drawing-fan-1', 'drawing', 'Fan 1', 'fan', 0, 60, datetime('now')),
('drawing-fan-2', 'drawing', 'Fan 2', 'fan', 0, 60, datetime('now')),
('drawing-light-1', 'drawing', 'Light 1', 'light', 0, 15, datetime('now')),
('drawing-light-2', 'drawing', 'Light 2', 'light', 0, 15, datetime('now')),
('drawing-light-3', 'drawing', 'Light 3', 'light', 0, 15, datetime('now'));

-- Work Room 1
INSERT OR IGNORE INTO devices (id, room_id, name, type, is_on, rated_power_watts, last_changed) VALUES
('work1-fan-1', 'work1', 'Fan 1', 'fan', 0, 60, datetime('now')),
('work1-fan-2', 'work1', 'Fan 2', 'fan', 0, 60, datetime('now')),
('work1-light-1', 'work1', 'Light 1', 'light', 0, 15, datetime('now')),
('work1-light-2', 'work1', 'Light 2', 'light', 0, 15, datetime('now')),
('work1-light-3', 'work1', 'Light 3', 'light', 0, 15, datetime('now'));

-- Work Room 2
INSERT OR IGNORE INTO devices (id, room_id, name, type, is_on, rated_power_watts, last_changed) VALUES
('work2-fan-1', 'work2', 'Fan 1', 'fan', 0, 60, datetime('now')),
('work2-fan-2', 'work2', 'Fan 2', 'fan', 0, 60, datetime('now')),
('work2-light-1', 'work2', 'Light 1', 'light', 0, 15, datetime('now')),
('work2-light-2', 'work2', 'Light 2', 'light', 0, 15, datetime('now')),
('work2-light-3', 'work2', 'Light 3', 'light', 0, 15, datetime('now'));
```
