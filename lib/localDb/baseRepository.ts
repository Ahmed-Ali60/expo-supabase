// lib/localDb/baseRepository.ts
import { getDb } from './index';
import { v4 as uuidv4 } from 'uuid';

export interface BaseEntity {
  id: number;
  uuid: string;
  name: string;
  supabase_id?: number;
  is_synced?: number;
  operation_type?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract tableName: string;
  protected abstract displayName: string;

  async getAll(): Promise<T[]> {
    const db = getDb();
    const result = await db.getAllAsync(
      `SELECT * FROM ${this.tableName} WHERE (deleted_at IS NULL OR deleted_at = '') ORDER BY id ASC`
    );
    return result as T[];
  }

  async getById(id: number): Promise<T | null> {
    const db = getDb();
    const result = await db.getFirstAsync(
      `SELECT * FROM ${this.tableName} WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      [id]
    );
    return result as T | null;
  }

  async getByUuid(uuid: string): Promise<T | null> {
    const db = getDb();
    const result = await db.getFirstAsync(
      `SELECT * FROM ${this.tableName} WHERE uuid = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      [uuid]
    );
    return result as T | null;
  }

  async insert(item: Partial<T>): Promise<{ localId: number; uuid: string }> {
    const db = getDb();
    const now = new Date().toISOString();
    const newUuid = uuidv4();

    return await db.withTransactionAsync(async () => {
      // Check for duplicates
      await this.checkDuplicates(item);

      const result = await this.performInsert(item, newUuid, now);
      const insertId = result.lastInsertRowId as number;

      // Add to sync queue if not from Supabase
      if (!item.supabase_id) {
        await this.addToSyncQueue('INSERT', insertId, newUuid, null, item, now);
      }

      return { localId: insertId, uuid: newUuid };
    });
  }

  async update(id: number, item: Partial<T>): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    return await db.withTransactionAsync(async () => {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`${this.displayName} غير موجود محلياً`);
      }

      // Check for duplicates (excluding current item)
      await this.checkDuplicates(item, id);

      await this.performUpdate(id, item, now);

      // Add to sync queue
      await this.addToSyncQueue('UPDATE', id, existing.uuid, existing.supabase_id, item, now);
    });
  }

  async delete(id: number): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    return await db.withTransactionAsync(async () => {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`${this.displayName} غير موجود محلياً`);
      }

      // Soft delete
      await db.runAsync(
        `UPDATE ${this.tableName} SET deleted_at = ?, is_synced = 0, operation_type = "DELETE", updated_at = ? WHERE id = ?`,
        [now, now, id]
      );

      // Add to sync queue
      await this.addToSyncQueue('DELETE', id, existing.uuid, existing.supabase_id, { deleted_at: now }, now);
    });
  }

  async markAsSynced(id: number): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `UPDATE ${this.tableName} SET is_synced = 1, operation_type = NULL WHERE id = ?`,
      [id]
    );
  }

  async updateSupabaseId(localId: number, supabaseId: number): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `UPDATE ${this.tableName} SET supabase_id = ?, is_synced = 1, operation_type = NULL WHERE id = ?`,
      [supabaseId, localId]
    );
  }

  async getUnsynced(): Promise<any[]> {
    const db = getDb();
    return await db.getAllAsync(
      `SELECT * FROM sync_queue WHERE entity = ? ORDER BY timestamp ASC`,
      [this.tableName]
    );
  }

  async clearSyncQueue(changeId: number): Promise<void> {
    const db = getDb();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [changeId]);
  }

  async mergeRemote(remoteItem: any): Promise<void> {
    const db = getDb();
    const existing = await this.getByUuid(remoteItem.uuid);

    if (!existing) {
      await this.insertFromRemote(remoteItem);
    } else {
      await this.updateFromRemote(remoteItem);
    }
  }

  protected abstract checkDuplicates(item: Partial<T>, excludeId?: number): Promise<void>;
  protected abstract performInsert(item: Partial<T>, uuid: string, now: string): Promise<any>;
  protected abstract performUpdate(id: number, item: Partial<T>, now: string): Promise<void>;
  protected abstract insertFromRemote(remoteItem: any): Promise<void>;
  protected abstract updateFromRemote(remoteItem: any): Promise<void>;

  private async addToSyncQueue(
    operation: string,
    localId: number,
    uuid: string,
    supabaseId: number | null | undefined,
    payload: any,
    timestamp: string
  ): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `INSERT INTO sync_queue (entity, entity_local_id, entity_uuid, entity_supabase_id, operation, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        this.tableName,
        localId,
        uuid,
        supabaseId || null,
        operation,
        JSON.stringify({ ...payload, uuid, updated_at: timestamp })
      ]
    );
  }
}

export { BaseRepository }