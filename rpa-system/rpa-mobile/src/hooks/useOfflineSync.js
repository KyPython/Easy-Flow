import { useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'offline_queue';
const CACHE_PREFIX = 'cache_';

export function useOfflineSync() {
  const [isConnected, setIsConnected] = useState(true);
  const [queueLength, setQueueLength] = useState(0);

  const getQueue = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const addToQueue = useCallback(async (method, url, body) => {
    const q = await getQueue();
    q.push({ method, url, body, id: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    setQueueLength(q.length);
  }, [getQueue]);

  const processQueue = useCallback(async (apiClient) => {
    const q = await getQueue();
    if (q.length === 0) return;
    let processed = 0;
    for (const item of q) {
      try {
        if (item.method === 'POST') await apiClient.post(item.url, item.body);
        else if (item.method === 'PUT') await apiClient.put(item.url, item.body);
        else if (item.method === 'DELETE') await apiClient.delete(item.url);
        processed++;
      } catch {
        break;
      }
    }
    if (processed > 0) {
      const remaining = q.slice(processed);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      setQueueLength(remaining.length);
    }
  }, [getQueue]);

  const cacheGet = useCallback(async (key) => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const cacheSet = useCallback(async (key, value) => {
    try {
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
    } catch {}
  }, []);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    getQueue().then((q) => setQueueLength(q.length));
    return () => sub();
  }, [getQueue]);

  return { isConnected, queueLength, addToQueue, processQueue, cacheGet, cacheSet };
}
