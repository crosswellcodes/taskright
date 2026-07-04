import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TaskPickerScreen({ route, navigation }) {
  const { cycle } = route.params;
  const insets = useSafeAreaInsets();
  const maxMinutes = cycle.totalMinutesAvailable;
  const [selected, setSelected] = useState([]);

  const usedMinutes = useMemo(() => {
    return selected.reduce((sum, id) => {
      const task = cycle.availableTasks.find(t => t.id === id);
      return sum + (task?.timeAllotmentMinutes || 0);
    }, 0);
  }, [selected, cycle.availableTasks]);

  const toggleTask = (task) => {
    const alreadySelected = selected.includes(task.id);
    if (!alreadySelected && usedMinutes + task.timeAllotmentMinutes > maxMinutes) {
      Alert.alert('Time limit reached', `Adding this task would exceed your ${cycle.totalHours}-hour limit.`);
      return;
    }
    setSelected(prev =>
      alreadySelected ? prev.filter(id => id !== task.id) : [...prev, task.id]
    );
  };

  const progressPercent = maxMinutes > 0 ? Math.min(usedMinutes / maxMinutes, 1) : 0;
  const remaining = maxMinutes - usedMinutes;

  return (
    <View style={styles.container}>
      {/* Time bar */}
      <View style={styles.timeBarContainer}>
        <View style={styles.timeBarBg}>
          <View style={[styles.timeBarFill, { width: `${progressPercent * 100}%` }]} />
        </View>
        <Text style={styles.timeText}>
          {usedMinutes} / {maxMinutes} min used &nbsp;·&nbsp; {remaining} min remaining
        </Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {cycle.availableTasks.map(task => {
          const isSelected = selected.includes(task.id);
          const wouldExceed = !isSelected && usedMinutes + task.timeAllotmentMinutes > maxMinutes;
          return (
            <TouchableOpacity
              key={task.id}
              style={[styles.taskCard, isSelected && styles.taskCardSelected, wouldExceed && styles.taskCardDisabled]}
              onPress={() => toggleTask(task)}
              disabled={wouldExceed && !isSelected}
            >
              <View style={styles.taskInfo}>
                <Text style={[styles.taskName, isSelected && styles.taskNameSelected]}>{task.name}</Text>
                <Text style={styles.taskTime}>{task.timeAllotmentMinutes} min</Text>
              </View>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.continueBtn, selected.length === 0 && styles.continueBtnDisabled]}
          onPress={() => navigation.navigate('Confirmation', { cycle, selectedTaskIds: selected })}
          disabled={selected.length === 0}
        >
          <Text style={styles.continueBtnText}>
            Review Selection ({selected.length} task{selected.length !== 1 ? 's' : ''})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  timeBarContainer: { backgroundColor: '#fff', padding: 16 },
  timeBarBg: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  timeBarFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 4 },
  timeText: { fontSize: 13, color: '#555' },
  list: { flex: 1 },
  taskCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10,
    borderRadius: 12, padding: 16, flexDirection: 'row',
    alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  taskCardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  taskCardDisabled: { opacity: 0.4 },
  taskInfo: { flex: 1 },
  taskName: { fontSize: 16, color: '#1a1a1a', marginBottom: 4 },
  taskNameSelected: { color: '#2563eb', fontWeight: '600' },
  taskTime: { fontSize: 13, color: '#888' },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: '#ccc', justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  continueBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: '#93c5fd' },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
