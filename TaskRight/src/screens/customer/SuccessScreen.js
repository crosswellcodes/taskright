import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SuccessScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.title}>Selection Submitted!</Text>
      <Text style={styles.subtitle}>
        Your tasks have been locked in. We'll see you on your service date.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'CurrentSelection' }] })}
      >
        <Text style={styles.btnText}>Back to Home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  icon: { fontSize: 64, color: '#10b981', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
