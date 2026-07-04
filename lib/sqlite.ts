
// lib/sqlite.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let dbInstance: Database | null = null;

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  let dbPath = path.join(process.cwd(), 'wattwatch.db');

  // Render Persistent Disk support
  if (fs.existsSync('/data')) {
    const diskPath = path.join('/data', 'wattwatch.db');
    try {
      if (!fs.existsSync(diskPath)) {
        console.log("[SQLite Render] Copying wattwatch.db to /data...");
        if (fs.existsSync(dbPath)) {
          fs.copyFileSync(dbPath, diskPath);
          console.log("[SQLite Render] Copy complete.");
        }
      }
      dbPath = diskPath;
    } catch (e) {
      console.error("[SQLite Render] Failed to handle /data copy:", e);
    }
  }
  // Vercel serverless compatibility layer (read-only filesystem workaround)
  else if (process.env.VERCEL) {
    const tmpPath = path.join('/tmp', 'wattwatch.db');
    try {
      if (!fs.existsSync(tmpPath)) {
        console.log("[SQLite Vercel] Copying wattwatch.db to /tmp...");
        if (fs.existsSync(dbPath)) {
          fs.copyFileSync(dbPath, tmpPath);
          console.log("[SQLite Vercel] Copy complete.");
        } else {
          console.warn("[SQLite Vercel] Source wattwatch.db not found in process.cwd().");
        }
      }
      dbPath = tmpPath;
    } catch (e) {
      console.error("[SQLite Vercel] Failed to handle /tmp copy:", e);
    }
  }

  // Opens or creates the wattwatch.db file
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await dbInstance.exec('PRAGMA foreign_keys = ON;');

  return dbInstance;
}