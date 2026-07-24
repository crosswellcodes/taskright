import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

// Persistent "you're clocked in" banner (Tier C). Lives above My Jobs so it
// outlives any single Call screen. Tapping deep-links to the active job.
function elapsedLabel(fromIso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 60000));
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}

export default function ClockedInBanner({ activeClock, onPress }) {
  // Re-render once a minute-worth of seconds ticks so the elapsed label stays live.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeClock) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeClock]);

  if (!activeClock) return null;
  const label = activeClock.arrivalAt ? elapsedLabel(activeClock.arrivalAt) : null;

  return (
    <TouchableOpacity style={styles.banner} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.dot} />
      <Text style={styles.text} numberOfLines={1}>
        You're clocked into {activeClock.customerName}{label ? ` · ${label}` : ''}
      </Text>
      <Text style={styles.cta}>Open ›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a7f3d0', marginRight: 10 },
  text: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  cta: { color: '#d1fae5', fontSize: 13, fontWeight: '700', marginLeft: 8 },
});
