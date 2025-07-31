// lib/localDb/levelsRepository.ts
import { BaseRepository, BaseEntity } from './baseRepository';
import { getDb } from './index';

export interface Level extends BaseEntity {}

export class LevelsRepository extends BaseRepository<Level> {
  protected tableName = 'levels';
  protected displayName = 'المستوى';

  protected async checkDuplicates(item: Partial<Level>, excludeId?: number): Promise<void> {
    if (!item.name?.trim()) {
      throw new Error('يرجى إدخال اسم المستوى');
    }

    const db = getDb();
    const query = excludeId 
      ? 'SELECT * FROM levels WHERE name = ? AND id != ? AND (deleted_at IS NULL OR deleted_at = "")'
      : 'SELECT * FROM levels WHERE name = ? AND (deleted_at IS NULL OR deleted_at = "")';
    
    const params = excludeId ? [item.name.trim(), excludeId] : [item.name.trim()];
    const existing = await db.getFirstAsync(query, params);
    
    if (existing) {
      throw new Error('اسم المستوى موجود بالفعل');
    }
  }

  protected async performInsert(item: Partial<Level>, uuid: string, now: string): Promise<any> {
    const db = getDb();
    return await db.runAsync(
      `INSERT INTO levels (uuid, name, supabase_id, is_synced, operation_type, created_at, updated_at)
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

  protected async performUpdate(id: number, item: Partial<Level>, now: string): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `UPDATE levels SET name = ?, is_synced = 0, operation_type = "UPDATE", updated_at = ? WHERE id = ?`,
      [item.name?.trim(), now, id]
    );
  }

  protected async insertFromRemote(remoteItem: any): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO levels (uuid, name, supabase_id, is_synced, created_at, updated_at, deleted_at)
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
      `UPDATE levels SET name = ?, updated_at = ?, is_synced = 1, operation_type = NULL WHERE uuid = ?`,
      [remoteItem.name, remoteItem.updated_at || remoteItem.created_at, remoteItem.uuid]
    );
  }
}

export const levelsRepository = new LevelsRepository();