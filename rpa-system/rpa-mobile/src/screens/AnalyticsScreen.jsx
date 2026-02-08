import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import api from '../api/apiClient';

export default function AnalyticsScreen() {
  const [data, setData] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [dashboardRes, workflowsRes] = await Promise.all([
        api.get('/api/dashboard'),
        api.get('/api/workflows'),
      ]);
      setData(dashboardRes.data);
      setWorkflows(Array.isArray(workflowsRes.data) ? workflowsRes.data : []);
    } catch (e) {
      setData(null);
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const recentRuns = data?.recentRuns ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAnalytics} />}
    >
      <Text style={styles.title}>Analytics</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data?.totalTasks ?? 0}</Text>
          <Text style={styles.statLabel}>Tasks</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data?.totalRuns ?? 0}</Text>
          <Text style={styles.statLabel}>Runs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{workflows.length}</Text>
          <Text style={styles.statLabel}>Workflows</Text>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Recent Runs</Text>
      {recentRuns.length === 0 ? (
        <Text style={styles.empty}>No recent runs</Text>
      ) : (
        recentRuns.slice(0, 10).map((run) => (
          <View key={run.id} style={styles.runRow}>
            <Text style={styles.runStatus}>{run.status}</Text>
            <Text style={styles.runMeta}>{run.automation_tasks?.name || 'Task'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  title: { fontSize: 22, fontWeight: '600', color: '#f1f5f9', marginBottom: 16 },
  statsRow: { flexDirection: 'row', marginBottom: 24, marginHorizontal: -6 },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#3b82f6' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  sectionTitle: { fontSize: 16, color: '#94a3b8', marginBottom: 12 },
  runRow: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  runStatus: { color: '#3b82f6', fontWeight: '600' },
  runMeta: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 16 },
});
