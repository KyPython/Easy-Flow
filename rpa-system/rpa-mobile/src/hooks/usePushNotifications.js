import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import api from '../api/apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true }),
});

export function usePushNotifications(user) {
  const registered = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    if (registered.current) return;
    registered.current = true;

    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        let finalStatus = status;
        if (status !== 'granted') {
          const { status: req } = await Notifications.requestPermissionsAsync();
          finalStatus = req;
        }
        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID || undefined,
        });
        const token = tokenData?.data;
        if (!token) return;

        await api.put('/api/user/preferences', { fcm_token: token });
      } catch (e) {
        // Silently fail - push is optional
      }
    })();
  }, [user?.id]);
}
