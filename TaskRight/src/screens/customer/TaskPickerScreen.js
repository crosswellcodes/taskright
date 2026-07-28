import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TaskPickerScreen({ route, navigation }) {
  const { cycle } = route.params;
  const insets = useSafeAreaInsets();

  // Every task on the menu is included. The customer optionally reorders them
  // to signal what matters most — leaving the default order is perfectly fine.
  const [ordered, setOrdered] = useState(() => cycle.availableTasks || []);

  const move = (index, dir) => {
    setOrdered(prev => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  if (ordered.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No tasks have been added to this service yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.introCard}>
        <Text style={styles.introTitle}>Rank what matters most</Text>
        <Text style={styles.introBody}>
          Every task below is part of your service. Use the arrows to put them in the
          order that matters most to you — this is optional, so you can leave them as they are.
        </Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {ordered.map((task, index) => {
          const isFirst = index === 0;
          const isLast = index === ordered.length - 1;
          return (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.taskName} numberOfLines={2}>{task.name}</Text>
              <View style={styles.arrows}>
                <TouchableOpacity
                  style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]}
                  onPress={() => move(index, -1)}
                  disabled={isFirst}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={[styles.arrowText, isFirst && styles.arrowTextDisabled]}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]}
                  onPress={() => move(index, 1)}
                  disabled={isLast}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={[styles.arrowText, isLast && styles.arrowTextDisabled]}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => navigation.navigate('Confirmation', {
            cycle,
            selectedTaskIds: ordered.map(t => t.id),
          })}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#f5f5f5' },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
  introCard: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 16 },
  introTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  introBody: { fontSize: 13, color: '#6b7280', lineHeight: 19 },
  list: { flex: 1 },
  taskCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10,
    borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center',
  },
  rankBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  rankBadgeText: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  taskName: { flex: 1, fontSize: 16, color: '#1a1a1a', marginRight: 12 },
  arrows: { flexDirection: 'row', alignItems: 'center' },
  arrowBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: '#f3f4f6',
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  arrowBtnDisabled: { backgroundColor: '#fafafa' },
  arrowText: { fontSize: 15, color: '#2563eb', fontWeight: '700' },
  arrowTextDisabled: { color: '#d1d5db' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  continueBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
