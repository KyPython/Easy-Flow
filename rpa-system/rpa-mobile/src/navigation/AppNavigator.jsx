import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useOfflineSync } from '../hooks/useOfflineSync';
import OfflineBanner from '../components/OfflineBanner';
import OnboardingOverlay from '../components/OnboardingOverlay';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import FilesScreen from '../screens/FilesScreen';
import AutomationsScreen from '../screens/AutomationsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { user } = useAuth();
  usePushNotifications(user);
  const { isConnected } = useOfflineSync();

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner visible={!isConnected} />
      <OnboardingOverlay />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
          tabBarStyle: { backgroundColor: '#1e293b' },
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#64748b',
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
        <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
        <Tab.Screen name="Files" component={FilesScreen} options={{ title: 'Files' }} />
        <Tab.Screen name="Automations" component={AutomationsScreen} options={{ title: 'Automations' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Tab.Navigator>
    </View>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null; // or splash

  return (
    <SafeAreaProvider>
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
