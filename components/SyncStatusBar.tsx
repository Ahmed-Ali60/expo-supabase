// components/SyncStatusBar.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SyncStatusBarProps {
  isConnected: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: Date | null;
  onSyncPress: () => void;
}

export default function SyncStatusBar({
  isConnected,
  isSyncing,
  pendingCount,
  lastSync,
  onSyncPress
}: SyncStatusBarProps) {
  const getStatusColor = () => {
    if (!isConnected) return '#ef4444'; // red
    if (isSyncing) return '#f59e0b'; // amber
    if (pendingCount > 0) return '#f59e0b'; // amber
    return '#10b981'; // green
  };

  const getStatusText = () => {
    if (!isConnected) return 'غير متصل';
    if (isSyncing) return 'جاري المزامنة...';
    if (pendingCount > 0) return `${pendingCount} في الانتظار`;
    return 'متزامن';
  };

  const getStatusIcon = () => {
    if (!isConnected) return 'cloud-offline-outline';
    if (isSyncing) return 'sync-outline';
    if (pendingCount > 0) return 'time-outline';
    return 'cloud-done-outline';
  };

  const formatLastSync = () => {
    if (!lastSync) return '';
    const now = new Date();
    const diff = now.getTime() - lastSync.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  return (
    <View style={[styles.container, { backgroundColor: getStatusColor() }]}>
      <View style={styles.statusInfo}>
        <Ionicons name={getStatusIcon()} size={16} color="white" />
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {lastSync && (
          <Text style={styles.lastSyncText}>• {formatLastSync()}</Text>
        )}
      </View>
      
      {isConnected && !isSyncing && (
        <TouchableOpacity onPress={onSyncPress} style={styles.syncButton}>
          <Ionicons name="refresh-outline" size={16} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  lastSyncText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 8,
  },
  syncButton: {
    padding: 4,
  },
});