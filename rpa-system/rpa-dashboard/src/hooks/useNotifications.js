// React Hook for EasyFlow Notifications
// Provides easy integration of real-time notifications in React components

import { useState, useEffect, useCallback, useRef } from 'react';
import notificationService, { NotificationHelpers } from '../utils/notificationService';
import { useAuth } from '../utils/AuthContext';

export const useNotifications = (user) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [status, setStatus] = useState(notificationService.getStatus());
  const [authReady, setAuthReady] = useState(false);
  
  // Use refs to track state and prevent race conditions
  const initializingRef = useRef(false);
  const lastUserIdRef = useRef(null);
  const authTimeoutRef = useRef(null);

  // Wait for authentication to be ready before initializing notifications
  useEffect(() => {
    let mounted = true;

    const waitForAuthAndInitialize = async () => {
      // Early return if no user
      if (!user) {
        if (isInitialized || notificationService.isInitialized) {
          console.log('🔔 User logged out, cleaning up notifications');
          notificationService.cleanup();
          if (mounted) {
            setIsInitialized(false);
            setNotifications([]);
            setUnreadCount(0);
            setHasPermission(false);
            setStatus(notificationService.getStatus());
            setAuthReady(false);
          }
        }
        initializingRef.current = false;
        lastUserIdRef.current = null;
        return;
      }

      // Prevent redundant initialization
      if (initializingRef.current) {
        console.log('🔔 Initialization already in progress, skipping...');
        return;
      }

      // Check if already initialized for the same user
      if (lastUserIdRef.current === user.id && isInitialized) {
        console.log('🔔 Already initialized for user:', user.id);
        return;
      }

      // Check notification service state
      if (notificationService.isInitialized && notificationService.currentUser?.id === user.id) {
        console.log('🔔 NotificationService already initialized for user:', user.id);
        if (mounted) {
          setIsInitialized(true);
          const perm = typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false;
          setHasPermission(perm);
          setStatus(notificationService.getStatus());
          setAuthReady(true);
        }
        lastUserIdRef.current = user.id;
        return;
      }

      initializingRef.current = true;
      console.log('🔔 Starting notification initialization for user:', user.id);
      
      // Add a small delay to ensure auth context is fully ready
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
      }
      
      authTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('🔔 Authentication ready, initializing notifications...');
          setAuthReady(true);
          
          const success = await notificationService.initialize(user);
          
          if (mounted) {
            setIsInitialized(success);
            const perm = typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false;
            setHasPermission(perm);
            setStatus(notificationService.getStatus());
            
            if (success) {
              lastUserIdRef.current = user.id;
              console.log('🔔 Notifications initialized successfully');
            }
          }
        } catch (error) {
          console.error('🔔 Failed to initialize notifications:', error);
          if (mounted) {
            setIsInitialized(false);
            setAuthReady(false);
          }
        } finally {
          initializingRef.current = false;
        }
      }, 1000); // 1 second delay to ensure auth is ready
    };

    waitForAuthAndInitialize();

    return () => {
      mounted = false;
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
      }
    };
  }, [user?.id, isInitialized]); // Added isInitialized dependency for cleanup

  // Set up event listeners
  useEffect(() => {
    if (!isInitialized) return;

    // Handle notification updates
    const handleNotificationsUpdated = (event) => {
      if (event.notifications) {
        setNotifications(event.notifications);
        const unread = event.notifications.filter(n => !n.read).length;
        setUnreadCount(unread);
      }
    };

    // Handle individual notifications
    const handleNotification = (event) => {
      console.log('🔔 New notification received:', event);
      
      // Add to notifications list if it's a new notification
      if (event.type !== 'notifications_updated') {
        setNotifications(prev => [{
          id: Date.now().toString(),
          type: event.type,
          title: event.title,
          body: event.body,
          timestamp: new Date().toISOString(),
          read: false,
          data: event.data
        }, ...prev]);
        
        setUnreadCount(prev => prev + 1);
      }
    };

    // Handle notification clicks
    const handleNotificationClick = (event) => {
      console.log('🔔 Notification clicked:', event.data);
      
      // You can add custom navigation logic here
      if (event.data?.url) {
        window.location.href = event.data.url;
      }
    };

    // Add event listeners
    notificationService.addEventListener('notifications_updated', handleNotificationsUpdated);
    notificationService.addEventListener('notification', handleNotification);
    notificationService.addEventListener('notification_clicked', handleNotificationClick);

    // Cleanup listeners
    return () => {
      notificationService.removeEventListener('notifications_updated', handleNotificationsUpdated);
      notificationService.removeEventListener('notification', handleNotification);
      notificationService.removeEventListener('notification_clicked', handleNotificationClick);
    };
  }, [isInitialized]);

  // Request permission
  const requestPermission = useCallback(async () => {
    try {
      const granted = await notificationService.requestPermission();
      setHasPermission(granted);
      setStatus(notificationService.getStatus());
      return granted;
    } catch (error) {
      console.error('🔔 Error requesting permission:', error);
      return false;
    }
  }, []);

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    if (!user) return Promise.resolve(false);

    const testNotification = {
      type: 'test',
      title: 'Test Notification',
      body: 'This is a test notification from EasyFlow',
      priority: 'normal'
    };

    return await notificationService.sendNotification(user.id, testNotification);
  }, [user]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    const success = await notificationService.markAsRead(notificationId);
    
    if (success) {
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    return success;
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      // Mark all notifications as read locally
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      // Update in Firebase (you might want to batch this)
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifications.map(n => notificationService.markAsRead(n.id))
      );
      
      return true;
    } catch (error) {
      console.error('🔔 Error marking all as read:', error);
      return false;
    }
  }, [notifications]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    const success = await notificationService.clearAllNotifications();
    
    if (success) {
      setNotifications([]);
      setUnreadCount(0);
    }
    
    return success;
  }, []);

  // Send notification helpers
  const sendTaskCompleted = useCallback((taskName) => {
    if (!user) return Promise.resolve(false);
    const notification = NotificationHelpers.taskCompleted(taskName, user.id);
    return notificationService.sendNotification(user.id, notification);
  }, [user]);

  const sendTaskFailed = useCallback((taskName, error) => {
    if (!user) return Promise.resolve(false);
    const notification = NotificationHelpers.taskFailed(taskName, error, user.id);
    return notificationService.sendNotification(user.id, notification);
  }, [user]);

  const sendSystemAlert = useCallback((message) => {
    if (!user) return Promise.resolve(false);
    const notification = NotificationHelpers.systemAlert(message, user.id);
    return notificationService.sendNotification(user.id, notification);
  }, [user]);

  const sendWelcome = useCallback((userName) => {
    if (!user) return Promise.resolve(false);
    const notification = NotificationHelpers.welcome(userName, user.id);
    return notificationService.sendNotification(user.id, notification);
  }, [user]);

  // Enable push notifications (persist preference + token)
  const enablePush = useCallback(async () => {
    const ok = await notificationService.enablePush();
    setStatus(notificationService.getStatus());
  const perm = typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false;
  setHasPermission(perm);
    return ok;
  }, []);

  // Disable push notifications (persist preference + revoke token)
  const disablePush = useCallback(async () => {
    const ok = await notificationService.disablePush();
    setStatus(notificationService.getStatus());
    return ok;
  }, []);

  return {
    // State
    notifications,
    unreadCount,
    isInitialized,
    hasPermission,
    status,
    
    // Actions
    requestPermission,
    sendTestNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    enablePush,
    disablePush,
    
    // Notification helpers
    sendTaskCompleted,
    sendTaskFailed,
    sendSystemAlert,
    sendWelcome,
    
    // Service status
    isSupported: status.isSupported,
    isConfigured: status.isConfigured
  };
};