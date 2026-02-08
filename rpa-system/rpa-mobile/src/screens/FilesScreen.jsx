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
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import api from '../api/apiClient';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3030';

export default function FilesScreen() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/files');
      const list = data?.files ?? data;
      setFiles(Array.isArray(list) ? list : []);
    } catch (e) {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const uploadFile = async (uri, fileName, mimeType) => {
    setUploading(true);
    try {
      const { getAuthToken } = await import('../api/apiClient');
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName || 'upload',
        type: mimeType || 'application/octet-stream',
      } as any);
      const res = await fetch(`${API_BASE}/api/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      await fetchFiles();
    } catch (e) {
      Alert.alert('Upload Failed', e instanceof Error ? e.message : 'Could not upload file');
    } finally {
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      await uploadFile(file.uri, file.name, file.mimeType || 'application/octet-stream');
    } catch (e) {
      Alert.alert('Error', 'Could not pick document');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to capture photos');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() || 'jpg';
    await uploadFile(asset.uri, `photo_${Date.now()}.${ext}`, asset.mimeType || 'image/jpeg');
  };

  const downloadFile = async (item) => {
    try {
      const { data } = await api.get(`/api/files/${item.id}/download`);
      const url = data.download_url;
      if (url) await Linking.openURL(url);
      else Alert.alert('Download', 'No download URL returned');
    } catch (e) {
      Alert.alert('Download Failed', e.response?.data?.error || 'Could not get download link');
    }
  };

  const deleteFile = async (item) => {
    Alert.alert('Delete', `Delete "${item.original_name || item.display_name || 'this file'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/files/${item.id}`);
            await fetchFiles();
          } catch (e) {
            Alert.alert('Delete Failed', e.response?.data?.error || 'Could not delete');
          }
        },
      },
    ]);
  };

  if (loading && files.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Files</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btn} onPress={takePhoto} disabled={uploading}>
            <Text style={styles.btnText}>📷 Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={pickDocument} disabled={uploading}>
            <Text style={styles.btnText}>📁 Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={files}
        keyExtractor={(item) => item.id || String(Math.random())}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity style={styles.rowContent} onPress={() => downloadFile(item)}>
              <Text style={styles.fileName} numberOfLines={1}>
                {item.original_name || item.display_name || item.file_name || 'Unnamed'}
              </Text>
              <Text style={styles.fileMeta}>{item.file_size ? `${(item.file_size / 1024).toFixed(1)} KB` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteFile(item)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchFiles} />}
        ListEmptyComponent={<Text style={styles.empty}>No files yet. Use Photo or Upload to add files.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, color: '#f1f5f9' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { backgroundColor: '#3b82f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  row: { backgroundColor: '#1e293b', borderRadius: 8, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowContent: { flex: 1 },
  fileName: { color: '#f1f5f9', fontSize: 16 },
  fileMeta: { color: '#64748b', fontSize: 12, marginTop: 4 },
  deleteBtn: { paddingLeft: 12 },
  deleteText: { color: '#ef4444', fontSize: 14 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 24 },
});
