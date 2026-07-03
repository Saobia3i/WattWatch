// lib/init-db.ts
import { getDb } from "./sqlite";

export async function initializeDatabase() {
  const db = await getDb();

  await db.exec(`
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
  `);

  // Seed the rooms
  await db.exec(`
    INSERT OR IGNORE INTO rooms (id, name, max_capacity) VALUES 
    ('drawing', 'Drawing Room', 8),
    ('work1', 'Work Room 1', 12),
    ('work2', 'Work Room 2', 12);
  `);

  // Seed the sensors
  await db.exec(`
    INSERT OR IGNORE INTO room_sensors (room_id, is_occupied, enter_count, exit_count, last_motion_at) VALUES
    ('drawing', 1, 1, 0, datetime('now')),
    ('work1', 1, 2, 0, datetime('now')),
    ('work2', 1, 2, 0, datetime('now'));
  `);

  // Seed all 15 Devices
  await db.exec(`
    INSERT OR IGNORE INTO devices (id, room_id, name, type, is_on, rated_power_watts, last_changed) VALUES
    ('drawing-fan-1', 'drawing', 'Fan 1', 'fan', 0, 60, datetime('now')),
    ('drawing-fan-2', 'drawing', 'Fan 2', 'fan', 0, 60, datetime('now')),
    ('drawing-light-1', 'drawing', 'Light 1', 'light', 0, 15, datetime('now')),
    ('drawing-light-2', 'drawing', 'Light 2', 'light', 0, 15, datetime('now')),
    ('drawing-light-3', 'drawing', 'Light 3', 'light', 0, 15, datetime('now')),
    ('work1-fan-1', 'work1', 'Fan 1', 'fan', 0, 60, datetime('now')),
    ('work1-fan-2', 'work1', 'Fan 2', 'fan', 0, 60, datetime('now')),
    ('work1-light-1', 'work1', 'Light 1', 'light', 0, 15, datetime('now')),
    ('work1-light-2', 'work1', 'Light 2', 'light', 0, 15, datetime('now')),
    ('work1-light-3', 'work1', 'Light 3', 'light', 0, 15, datetime('now')),
    ('work2-fan-1', 'work2', 'Fan 1', 'fan', 0, 60, datetime('now')),
    ('work2-fan-2', 'work2', 'Fan 2', 'fan', 0, 60, datetime('now')),
    ('work2-light-1', 'work2', 'Light 1', 'light', 0, 15, datetime('now')),
    ('work2-light-2', 'work2', 'Light 2', 'light', 0, 15, datetime('now')),
    ('work2-light-3', 'work2', 'Light 3', 'light', 0, 15, datetime('now'));
  `);
}
