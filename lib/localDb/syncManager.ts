// lib/localDb/syncManager.ts
import { supabase } from '@/lib/supabase';
import { getDb } from './index';
import NetInfo from '@react-native-community/netinfo';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export class SyncManager {
  private static instance: SyncManager;
  private isOnline = false;
  private syncInProgress = false;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  private constructor() {
    this.initNetworkListener();
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private initNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOffline && this.isOnline) {
        console.log('📶 Network restored, triggering sync...');
        this.syncAll().catch(console.error);
      }
    });
  }

  async syncAll(): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping...');
      return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress'] };
    }

    if (!this.isOnline) {
      console.log('📵 Offline, skipping sync...');
      return { success: false, synced: 0, failed: 0, errors: ['Device is offline'] };
    }

    this.syncInProgress = true;
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      const db = getDb();
      const changes = await db.getAllAsync(`
        SELECT * FROM sync_queue 
        WHERE retry_count < ? 
        ORDER BY timestamp ASC
      `, [this.maxRetries]);

      console.log(`🔄 Starting sync for ${changes.length} changes...`);

      for (const change of changes) {
        try {
          await this.syncChange(change);
          await this.clearSyncChange(change.id);
          result.synced++;
          console.log(`✅ Synced ${change.entity} ${change.operation}`);
        } catch (error: any) {
          await this.handleSyncError(change, error);
          result.failed++;
          result.errors.push(`${change.entity}: ${error.message}`);
          console.error(`❌ Failed to sync ${change.entity}:`, error.message);
        }
      }

      // Fetch remote changes after pushing local changes
      await this.fetchRemoteChanges();
      
      result.success = result.failed === 0;
      console.log(`🎯 Sync completed: ${result.synced} synced, ${result.failed} failed`);
      
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      console.error('❌ Sync process failed:', error);
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  private async syncChange(change: any): Promise<void> {
    const payload = JSON.parse(change.payload);
    
    switch (change.operation) {
      case 'INSERT':
        await this.handleInsert(change.entity, payload, change);
        break;
      case 'UPDATE':
        await this.handleUpdate(change.entity, payload, change);
        break;
      case 'DELETE':
        await this.handleDelete(change.entity, change);
        break;
      default:
        throw new Error(`Unknown operation: ${change.operation}`);
    }
  }

  private async handleInsert(entity: string, payload: any, change: any): Promise<void> {
    const { data, error } = await supabase
      .from(entity)
      .insert([{ ...payload, is_synced: true }])
      .select()
      .single();

    if (error) throw error;

    // Update local record with Supabase ID
    const db = getDb();
    await db.runAsync(
      `UPDATE ${entity} SET supabase_id = ?, is_synced = 1, operation_type = NULL WHERE uuid = ?`,
      [data.id, change.entity_uuid]
    );
  }

  private async handleUpdate(entity: string, payload: any, change: any): Promise<void> {
    if (!change.entity_supabase_id) {
      throw new Error('Cannot update: missing Supabase ID');
    }

    const { error } = await supabase
      .from(entity)
      .update({ ...payload, is_synced: true })
      .eq('id', change.entity_supabase_id)
      .is('deleted_at', null);

    if (error) throw error;

    // Mark local record as synced
    const db = getDb();
    await db.runAsync(
      `UPDATE ${entity} SET is_synced = 1, operation_type = NULL WHERE id = ?`,
      [change.entity_local_id]
    );
  }

  private async handleDelete(entity: string, change: any): Promise<void> {
    if (!change.entity_supabase_id) {
      // If no Supabase ID, just mark as synced locally
      const db = getDb();
      await db.runAsync(
        `UPDATE ${entity} SET is_synced = 1, operation_type = NULL WHERE id = ?`,
        [change.entity_local_id]
      );
      return;
    }

    const { error } = await supabase
      .from(entity)
      .update({ deleted_at: new Date().toISOString(), is_synced: true })
      .eq('id', change.entity_supabase_id);

    if (error) throw error;

    // Mark local record as synced
    const db = getDb();
    await db.runAsync(
      `UPDATE ${entity} SET is_synced = 1, operation_type = NULL WHERE id = ?`,
      [change.entity_local_id]
    );
  }

  private async handleSyncError(change: any, error: Error): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
      [error.message, change.id]
    );
  }

  private async clearSyncChange(changeId: number): Promise<void> {
    const db = getDb();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [changeId]);
  }

  private async fetchRemoteChanges(): Promise<void> {
    const entities = ['levels', 'offices', 'students'];
    
    for (const entity of entities) {
      try {
        await this.fetchEntityChanges(entity);
      } catch (error: any) {
        console.error(`Failed to fetch ${entity} changes:`, error.message);
      }
    }
  }

  private async fetchEntityChanges(entity: string): Promise<void> {
    const { data: remoteItems, error } = await supabase
      .from(entity)
      .select('*')
      .order('updated_at', { ascending: true });

    if (error) throw error;

    const db = getDb();
    const localItems = await db.getAllAsync(`
      SELECT * FROM ${entity} WHERE deleted_at IS NULL OR deleted_at = ''
    `);

    await db.withTransactionAsync(async () => {
      for (const remoteItem of remoteItems || []) {
        const localItem = localItems.find((l: any) => l.uuid === remoteItem.uuid);

        if (remoteItem.deleted_at) {
          if (localItem && !localItem.deleted_at) {
            await db.runAsync(
              `UPDATE ${entity} SET deleted_at = ?, is_synced = 1, operation_type = NULL WHERE uuid = ?`,
              [remoteItem.deleted_at, remoteItem.uuid]
            );
          }
          continue;
        }

        if (!localItem) {
          // Insert new remote item
          await this.insertRemoteItem(entity, remoteItem);
        } else {
          // Check if remote is newer
          const remoteTime = new Date(remoteItem.updated_at || remoteItem.created_at).getTime();
          const localTime = new Date(localItem.updated_at || localItem.created_at).getTime();

          if (remoteTime > localTime && localItem.is_synced) {
            await this.updateLocalFromRemote(entity, remoteItem);
          }
        }
      }
    });
  }

  private async insertRemoteItem(entity: string, remoteItem: any): Promise<void> {
    const db = getDb();
    
    if (entity === 'students') {
      await db.runAsync(`
        INSERT OR IGNORE INTO students 
        (uuid, name, birth_date, phone, address, office_id, level_id, supabase_id, is_synced, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [
        remoteItem.uuid,
        remoteItem.name,
        remoteItem.birth_date,
        remoteItem.phone,
        remoteItem.address,
        remoteItem.office_id,
        remoteItem.level_id,
        remoteItem.id,
        remoteItem.created_at,
        remoteItem.updated_at || remoteItem.created_at
      ]);
    } else {
      await db.runAsync(`
        INSERT OR IGNORE INTO ${entity} 
        (uuid, name, supabase_id, is_synced, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
      `, [
        remoteItem.uuid,
        remoteItem.name,
        remoteItem.id,
        remoteItem.created_at,
        remoteItem.updated_at || remoteItem.created_at
      ]);
    }
  }

  private async updateLocalFromRemote(entity: string, remoteItem: any): Promise<void> {
    const db = getDb();
    
    if (entity === 'students') {
      await db.runAsync(`
        UPDATE students SET 
        name = ?, birth_date = ?, phone = ?, address = ?, 
        office_id = ?, level_id = ?, updated_at = ?, is_synced = 1
        WHERE uuid = ?
      `, [
        remoteItem.name,
        remoteItem.birth_date,
        remoteItem.phone,
        remoteItem.address,
        remoteItem.office_id,
        remoteItem.level_id,
        remoteItem.updated_at || remoteItem.created_at,
        remoteItem.uuid
      ]);
    } else {
      await db.runAsync(`
        UPDATE ${entity} SET name = ?, updated_at = ?, is_synced = 1 WHERE uuid = ?
      `, [
        remoteItem.name,
        remoteItem.updated_at || remoteItem.created_at,
        remoteItem.uuid
      ]);
    }
  }

  async getPendingSyncCount(): Promise<number> {
    const db = getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_queue WHERE retry_count < ?',
      [this.maxRetries]
    );
    return result?.count || 0;
  }

  async clearFailedSyncs(): Promise<void> {
    const db = getDb();
    await db.runAsync('DELETE FROM sync_queue WHERE retry_count >= ?', [this.maxRetries]);
  }

  get isConnected(): boolean {
    return this.isOnline;
  }

  get isSyncing(): boolean {
    return this.syncInProgress;
  }
}

export const syncManager = SyncManager.getInstance();