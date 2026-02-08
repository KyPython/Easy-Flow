import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function OfflineBanner({ visible }) {
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#f59e0b',
    padding: 10,
    alignItems: 'center',
  },
  text: { color: '#000', fontWeight: '600' },
});
