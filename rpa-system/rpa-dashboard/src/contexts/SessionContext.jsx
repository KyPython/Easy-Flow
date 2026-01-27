/**
 * Session Context - Consolidated user session data
 * Fetches plan, preferences, and notifications in a single API call
 * to reduce initial request count and prevent rate limiting
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../utils/AuthContext';
import { api } from '../utils/api';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
 const { user } = useAuth();
 const [sessionData, setSessionData] = useState(null);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState(null);
 const [lastFetch, setLastFetch] = useState(0);
 const fetchedUserIdRef = useRef(null); // Track which user we've fetched for

 const fetchSessionData = useCallback(async () => {
 if (!user?.id) {
 setSessionData(null);
 setIsLoading(false);
 return;
 }

 // Prevent concurrent fetches
 if (fetchSessionData.inFlight) return;
 fetchSessionData.inFlight = true;

 try {
 setIsLoading(true);
 setError(null);
 
 const response = await api.get('/api/user/session');
 setSessionData(response.data);
 setLastFetch(Date.now());
 } catch (err) {
 // Use console.debug instead of console.error to reduce noise
 console.debug('[SessionContext] Failed to fetch session data:', err);
 setError(err);
 // Don't set sessionData to null on error - keep previous data if available
 } finally {
 setIsLoading(false);
 fetchSessionData.inFlight = false;
 }
 }, [user?.id]);

 // Fetch session data when user changes (only once per user change)
 useEffect(() => {
 if (!user?.id) {
 setSessionData(null);
 setIsLoading(false);
 fetchedUserIdRef.current = null;
 return;
 }
 
 // Only fetch if we haven't fetched for this user yet
 if (fetchedUserIdRef.current !== user.id) {
 fetchedUserIdRef.current = user.id;
 fetchSessionData();
 }
 }, [user?.id, fetchSessionData]);

 // Refresh function for manual updates
 const refresh = useCallback(() => {
 fetchSessionData();
 }, [fetchSessionData]);

 // Auto-refresh every 5 minutes if data is stale
 // Use ref to avoid dependency on fetchSessionData (prevents infinite loops)
 const fetchSessionDataRef = useRef(fetchSessionData);
 useEffect(() => {
 fetchSessionDataRef.current = fetchSessionData;
 }, [fetchSessionData]);

 useEffect(() => {
 if (!sessionData || !user?.id || !lastFetch) return;

 const interval = setInterval(() => {
 const now = Date.now();
 const fiveMinutes = 5 * 60 * 1000;
 
 if (now - lastFetch > fiveMinutes) {
 fetchSessionDataRef.current();
 }
 }, 5 * 60 * 1000); // Check every 5 minutes (not every minute)

 return () => clearInterval(interval);
 }, [sessionData, user?.id, lastFetch]);

 const value = {
 // Session data
 plan: sessionData?.plan || null,
 preferences: sessionData?.preferences || null,
 notifications: sessionData?.notifications || null,
 user: sessionData?.user || null,
 
 // State
 isLoading,
 error,
 
 // Actions
 refresh,
 fetchSessionData
 };

 return (
 <SessionContext.Provider value={value}>
 {children}
 </SessionContext.Provider>
 );
}

export function useSession() {
 const context = useContext(SessionContext);
 // Return null instead of throwing to allow graceful fallback
 // Components can check if context is null and fall back to individual API calls
 return context;
}

export default SessionContext;

