// lib/localDb/officesRepository.ts
import { BaseRepository, BaseEntity } from './baseRepository';
import { getDb } from './index';

export interface Office extends BaseEntity {}

export class OfficesRepository extends BaseRepository<Office> {
  protected tableName = 'offices';
  protected displayName = 'المركز';

  protected async checkDuplicates(item: Partial<Office>, excludeId?: number): Promise<void> {
    if (!item.name?.trim()) {
      throw new Error('يرجى إدخال اسم المركز');
    }

    const db = getDb();
    const query = excludeId 
      ? 'SELECT * FROM offices WHERE name = ? AND id != ? AND (deleted_at IS NULL OR deleted_at = "")'
      : 'SELECT * FROM offices WHERE name = ? AND (deleted_at IS NULL OR deleted_at = "")';
    
    const params = excludeId ? [item.name.trim(), excludeId] : [item.name.trim()];
    const existing = await db.getFirstAsync(query, params);
    
    if (existing) {
      throw new Error('اسم المركز موجود بالفعل');
    }
  }

  protected async performInsert(item: Partial<Office>, uuid: string, now: string): Promise<any> {
    const db = getDb();
    return await db.runAsync(
      `INSERT INTO offices (uuid, name, supabase_id, is_synced, operation_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        item.name?.trim(),
        item.supabase_id || null,
        item.supabase_id ? 1 : 0,
        item.supabase_id ? null : 'INSERT',
        now,
        now
      ]
    );
  }

  protected async performUpdate(id: number, item: Partial<Office>, now: string): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `UPDATE offices SET name = ?, is_synced = 0, operation_type = "UPDATE", updated_at = ? WHERE id = ?`,
      [item.name?.trim(), now, id]
    );
  }

  protected async insertFromRemote(remoteItem: any): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO offices (uuid, name, supabase_id, is_synced, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [
        remoteItem.uuid,
        remoteItem.name,
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
      `UPDATE offices SET name = ?, updated_at = ?, is_synced = 1, operation_type = NULL WHERE uuid = ?`,
      [remoteItem.name, remoteItem.updated_at || remoteItem.created_at, remoteItem.uuid]
    );
  }
}

export const officesRepository = new OfficesRepository();