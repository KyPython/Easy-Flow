/**
 * API client for EasyFlow backend.
 * Reuses existing backend endpoints - no duplicate API logic.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth_token';

const getApiBaseUrl = () => {
  // Expo uses EXPO_PUBLIC_ prefix for env vars exposed to client
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API_BASE ||
    'http://localhost:3030'
  );
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach stored token to requests
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    // AsyncStorage unavailable
  }
  return config;
});

// Handle 401 - clear token
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      try {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } catch (e) {}
    }
    return Promise.reject(err);
  }
);

export const setAuthToken = async (token) => {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
};

export const getAuthToken = () => AsyncStorage.getItem(TOKEN_KEY);

export default api;
