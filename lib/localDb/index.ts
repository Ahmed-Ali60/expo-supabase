// lib/localDb/index.ts
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDb = async (): Promise<void> => {
  if (db) return;
  
  try {
    db = await SQLite.openDatabaseAsync('esm.db', { useNewConnection: true });
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA synchronous = NORMAL;');
    
    // Create profiles table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_profiles (
        supabase_id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        role TEXT,
        full_name TEXT,
        avatar_url TEXT,
        password_hash TEXT,
        last_login_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create levels table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        supabase_id INTEGER UNIQUE,
        is_synced INTEGER DEFAULT 0,
        operation_type TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        UNIQUE(name) WHERE deleted_at IS NULL
      );
    `);

    // Create offices table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        supabase_id INTEGER UNIQUE,
        is_synced INTEGER DEFAULT 0,
        operation_type TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        UNIQUE(name) WHERE deleted_at IS NULL
      );
    `);

    // Create students table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        birth_date TEXT,
        phone TEXT,
        address TEXT,
        office_id INTEGER NOT NULL,
        level_id INTEGER NOT NULL,
        supabase_id INTEGER UNIQUE,
        is_synced INTEGER DEFAULT 0,
        operation_type TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        FOREIGN KEY (office_id) REFERENCES offices(supabase_id) ON DELETE RESTRICT,
        FOREIGN KEY (level_id) REFERENCES levels(supabase_id) ON DELETE RESTRICT,
        UNIQUE(name, office_id, level_id) WHERE deleted_at IS NULL
      );
    `);

    // Create sync queue table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        entity_local_id INTEGER,
        entity_uuid TEXT,
        entity_supabase_id INTEGER,
        operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create indexes for better performance
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_levels_uuid ON levels(uuid);
      CREATE INDEX IF NOT EXISTS idx_levels_supabase_id ON levels(supabase_id);
      CREATE INDEX IF NOT EXISTS idx_levels_sync ON levels(is_synced, operation_type);
      
      CREATE INDEX IF NOT EXISTS idx_offices_uuid ON offices(uuid);
      CREATE INDEX IF NOT EXISTS idx_offices_supabase_id ON offices(supabase_id);
      CREATE INDEX IF NOT EXISTS idx_offices_sync ON offices(is_synced, operation_type);
      
      CREATE INDEX IF NOT EXISTS idx_students_uuid ON students(uuid);
      CREATE INDEX IF NOT EXISTS idx_students_supabase_id ON students(supabase_id);
      CREATE INDEX IF NOT EXISTS idx_students_sync ON students(is_synced, operation_type);
      CREATE INDEX IF NOT EXISTS idx_students_office_level ON students(office_id, level_id);
      
      CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_retry ON sync_queue(retry_count);
    `);

    console.log('✅ Database initialized successfully with enhanced schema');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

export const getDb = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
};

export const closeDb = async (): Promise<void> => {
  if (db) {
    await db.closeAsync();
    db = null;
  }
};

// Database health check
export const checkDbHealth = async (): Promise<boolean> => {
  try {
    const db = getDb();
    await db.getFirstAsync('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};