import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <TouchableOpacity style={styles.logout} onPress={signOut}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  title: { fontSize: 20, color: '#f1f5f9', marginBottom: 8 },
  email: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  logout: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '600' },
});
