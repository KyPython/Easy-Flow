import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import api from '../api/apiClient';

export default function AutomationsScreen() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(null);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/workflows');
      setWorkflows(Array.isArray(data) ? data : []);
    } catch (e) {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const runWorkflow = async (id) => {
    setExecuting(id);
    try {
      await api.post(`/api/workflows/${id}/executions`, {});
      Alert.alert('Started', 'Workflow execution started.');
      await fetchWorkflows();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to run workflow');
    } finally {
      setExecuting(null);
    }
  };

  if (loading && workflows.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Automations</Text>
      <FlatList
        data={workflows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name || 'Untitled Workflow'}</Text>
            <Text style={styles.meta}>{item.status || 'Active'}</Text>
            <TouchableOpacity
              style={[styles.runBtn, executing === item.id && styles.runBtnDisabled]}
              onPress={() => runWorkflow(item.id)}
              disabled={!!executing}
            >
              <Text style={styles.runBtnText}>
                {executing === item.id ? 'Running...' : 'Run'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchWorkflows} />}
        ListEmptyComponent={<Text style={styles.empty}>No workflows yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  title: { fontSize: 20, color: '#f1f5f9', marginBottom: 16 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  name: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },
  meta: { color: '#64748b', fontSize: 13, marginTop: 4 },
  runBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  runBtnDisabled: { opacity: 0.6 },
  runBtnText: { color: '#fff', fontWeight: '600' },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 24 },
});
