import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/apiClient';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get('/api/dashboard');
      setData(res);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboard} />}
    >
      <Text style={styles.greeting}>Hello, {user?.email?.split('@')[0] || 'User'}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardValue}>{data.totalTasks ?? 0}</Text>
            <Text style={styles.cardLabel}>Total Tasks</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardValue}>{data.totalRuns ?? 0}</Text>
            <Text style={styles.cardLabel}>Runs</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardValue}>{(data.recentRuns ?? []).length}</Text>
            <Text style={styles.cardLabel}>Recent Runs</Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  greeting: { fontSize: 20, color: '#f1f5f9', marginBottom: 20 },
  error: { color: '#ef4444', marginBottom: 12 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  cardValue: { fontSize: 24, fontWeight: '700', color: '#3b82f6' },
  cardLabel: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
});
