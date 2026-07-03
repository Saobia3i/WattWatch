
// lib/sqlite.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  // Opens or creates the wattwatch.db file
  dbInstance = await open({
    filename: path.join(process.cwd(), 'wattwatch.db'),
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await dbInstance.exec('PRAGMA foreign_keys = ON;');

  return dbInstance;
}