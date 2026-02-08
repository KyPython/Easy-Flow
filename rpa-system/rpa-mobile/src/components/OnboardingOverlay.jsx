import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_KEY = 'onboarding_seen';

export default function OnboardingOverlay({ onComplete }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  React.useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((v) => {
      if (v !== 'true') setVisible(true);
    });
  }, []);

  const steps = [
    { title: 'Welcome to EasyFlow', desc: 'Automate tasks, manage files, and run workflows from your phone.' },
    { title: 'Dashboard', desc: 'See your task counts and recent runs at a glance.' },
    { title: 'Files', desc: 'Upload photos, pick documents, and download your files.' },
    { title: 'Automations', desc: 'Run your workflows with one tap.' },
  ];

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else {
      AsyncStorage.setItem(SEEN_KEY, 'true');
      setVisible(false);
      onComplete?.();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{steps[step]?.title}</Text>
          <Text style={styles.desc}>{steps[step]?.desc}</Text>
          <TouchableOpacity style={styles.btn} onPress={next}>
            <Text style={styles.btnText}>{step < steps.length - 1 ? 'Next' : 'Get Started'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#3b82f6', marginBottom: 12 },
  desc: { fontSize: 16, color: '#94a3b8', marginBottom: 24, lineHeight: 24 },
  btn: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
