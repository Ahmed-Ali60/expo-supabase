// lib/localDb/studentsRepository.ts
import { BaseRepository, BaseEntity } from './baseRepository';
import { getDb } from './index';

export interface Student extends BaseEntity {
  birth_date?: string;
  phone?: string;
  address?: string;
  office_id: number;
  level_id: number;
  office_name?: string;
  level_name?: string;
}

export class StudentsRepository extends BaseRepository<Student> {
  protected tableName = 'students';
  protected displayName = 'الطالب';

  async getAll(): Promise<Student[]> {
    const db = getDb();
    const result = await db.getAllAsync(`
      SELECT s.*, 
             o.name as office_name, 
             l.name as level_name 
      FROM students s
      LEFT JOIN offices o ON s.office_id = o.supabase_id
      LEFT JOIN levels l ON s.level_id = l.supabase_id
      WHERE (s.deleted_at IS NULL OR s.deleted_at = '') 
      ORDER BY s.id ASC
    `);
    return result as Student[];
  }

  protected async checkDuplicates(item: Partial<Student>, excludeId?: number): Promise<void> {
    if (!item.name?.trim()) {
      throw new Error('يرجى إدخال اسم الطالب');
    }

    if (!item.office_id) {
      throw new Error('يرجى اختيار المركز');
    }

    if (!item.level_id) {
      throw new Error('يرجى اختيار المستوى');
    }

    const db = getDb();
    const query = excludeId 
      ? 'SELECT * FROM students WHERE name = ? AND office_id = ? AND level_id = ? AND id != ? AND (deleted_at IS NULL OR deleted_at = "")'
      : 'SELECT * FROM students WHERE name = ? AND office_id = ? AND level_id = ? AND (deleted_at IS NULL OR deleted_at = "")';
    
    const params = excludeId 
      ? [item.name.trim(), item.office_id, item.level_id, excludeId]
      : [item.name.trim(), item.office_id, item.level_id];
    
    const existing = await db.getFirstAsync(query, params);
    
    if (existing) {
      throw new Error('اسم الطالب موجود بالفعل في هذا المركز والمستوى');
    }
  }

  protected async performInsert(item: Partial<Student>, uuid: string, now: string): Promise<any> {
    const db = getDb();
    return await db.runAsync(
      `INSERT INTO students (uuid, name, birth_date, phone, address, office_id, level_id, supabase_id, is_synced, operation_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        item.name?.trim(),
        item.birth_date || null,
        item.phone || null,
        item.address || null,
        item.office_id,
        item.level_id,
        item.supabase_id || null,
        item.supabase_id ? 1 : 0,
        item.supabase_id ? null : 'INSERT',
        now,
        now
      ]
    );
  }

  protected async performUpdate(id: number, item: Partial<Student>, now: string): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `UPDATE students SET name = ?, birth_date = ?, phone = ?, address = ?, office_id = ?, level_id = ?, is_synced = 0, operation_type = "UPDATE", updated_at = ? WHERE id = ?`,
      [
        item.name?.trim(),
        item.birth_date || null,
        item.phone || null,
        item.address || null,
        item.office_id,
        item.level_id,
        now,
        id
      ]
    );
  }

  protected async insertFromRemote(remoteItem: any): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO students (uuid, name, birth_date, phone, address, office_id, level_id, supabase_id, is_synced, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        remoteItem.uuid,
        remoteItem.name,
        remoteItem.birth_date,
        remoteItem.phone,
        remoteItem.address,
        remoteItem.office_id,
        remoteItem.level_id,
        remoteItem.id,
        remoteItem.created_at || new Date().toISOString(),
        remoteItem.updated_at || remoteItem.created_at || new Date().toISOString(),
        remoteItem.deleted_at || null
      ]
    );
  }

  protected async updateFromRemote(remoteItem: any): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `UPDATE students SET name = ?, birth_date = ?, phone = ?, address = ?, office_id = ?, level_id = ?, updated_at = ?, is_synced = 1, operation_type = NULL WHERE uuid = ?`,
      [
        remoteItem.name,
        remoteItem.birth_date,
        remoteItem.phone,
        remoteItem.address,
        remoteItem.office_id,
        remoteItem.level_id,
        remoteItem.updated_at || remoteItem.created_at,
        remoteItem.uuid
      ]
    );
  }

  async getByOfficeAndLevel(officeId: number, levelId: number): Promise<Student[]> {
    const db = getDb();
    const result = await db.getAllAsync(`
      SELECT s.*, 
             o.name as office_name, 
             l.name as level_name 
      FROM students s
      LEFT JOIN offices o ON s.office_id = o.supabase_id
      LEFT JOIN levels l ON s.level_id = l.supabase_id
      WHERE s.office_id = ? AND s.level_id = ? AND (s.deleted_at IS NULL OR s.deleted_at = '') 
      ORDER BY s.name ASC
    `, [officeId, levelId]);
    return result as Student[];
  }
}

export const studentsRepository = new StudentsRepository();