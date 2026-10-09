/**
 * Example app (Expo or bare React Native).
 *   npx create-expo-app my-app && cd my-app
 *   npm i spres-react-native react-native-svg @react-native-async-storage/async-storage
 * then replace App.tsx with this file. Keep the API key publishable (pk_...).
 */
import React, { useRef, useState } from 'react';
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  BrainboxChat,
  BrainboxWidget,
  BrainboxWidgetHandle
} from 'spres-react-native';

const API_URL = 'https://port.smartpowerbilling.com';
const API_KEY = 'pk_live_your_publishable_key';

const quickActions = [
  { title: 'Track my order', prompt: 'How do I track my order?' },
  { title: 'Billing help', prompt: 'I have a question about my bill' },
  'Talk to a human'
];

export default function App() {
  const [screen, setScreen] = useState<'home' | 'chat'>('home');
  const widget = useRef<BrainboxWidgetHandle>(null);

  if (screen === 'chat') {
    // 1) Full-screen chat, e.g. as a tab or stack screen.
    return (
      <BrainboxChat
        apiUrl={API_URL}
        apiKey={API_KEY}
        user={{ id: 'user-42', name: 'Ada Lovelace' }}
        theme={{ mode: 'auto' }}
        branding={{ botName: 'Acme Assistant', subtitle: 'Typically replies in seconds' }}
        welcomeMessages={["I'm {{botName}}. Ask me anything about your account."]}
        quickActions={quickActions}
        onClose={() => setScreen('home')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Text style={styles.title}>My App</Text>
        <Pressable style={styles.button} onPress={() => setScreen('chat')}>
          <Text style={styles.buttonText}>Open full-screen chat</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => widget.current?.open()}>
          <Text style={styles.buttonText}>Open the widget from code</Text>
        </Pressable>
      </View>

      {/* 2) Floating launcher + slide-up chat sheet. Render once, last, at the root. */}
      <BrainboxWidget
        ref={widget}
        apiUrl={API_URL}
        apiKey={API_KEY}
        user={{ id: 'user-42', name: 'Ada Lovelace' }}
        theme={{ primary: '#0071E3', mode: 'light' }}
        branding={{ botName: 'Acme Assistant' }}
        quickActions={quickActions}
        position="bottom-right"
        onEvent={(name, detail) => console.log('[brainbox]', name, detail)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F7' },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '600', color: '#1D1D1F', letterSpacing: -0.5, marginBottom: 8 },
  button: { backgroundColor: '#0071E3', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '500' }
});
