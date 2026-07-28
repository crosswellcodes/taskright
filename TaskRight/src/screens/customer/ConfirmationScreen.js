import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { submitSelections } from '../../api/customerApi';

export default function ConfirmationScreen({ route, navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { cycle, selectedTaskIds } = route.params;
  const [loading, setLoading] = useState(false);

  // Preserve the customer's chosen priority order (map over the ids, don't filter the menu).
  const selectedTasks = useMemo(() =>
    selectedTaskIds
      .map(id => cycle.availableTasks.find(t => t.id === id))
      .filter(Boolean),
    [cycle, selectedTaskIds]
  );

  // Total hours is still computed for the submit payload (feeds the business-side
  // lifecycle/costing), but is no longer surfaced to the customer.
  const totalMinutes = selectedTasks.reduce((sum, t) => sum + t.timeAllotmentMinutes, 0);
  const totalHours = Math.ceil(totalMinutes / 60);

  const serviceDate = new Date(cycle.serviceDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await submitSelections(user.customerId, cycle.id, {
        selectedTasks: selectedTaskIds,
        selectedTotalHours: totalHours,
      });
      navigation.replace('Success');
    } catch (err) {
      if (err.code === 'ALREADY_SUBMITTED') {
        Alert.alert('Already Submitted', 'You have already submitted a selection for this cycle.');
        navigation.navigate('CurrentSelection');
      } else if (err.code === 'TIME_EXCEEDED') {
        Alert.alert('Time Exceeded', `Selected tasks exceed your time limit of ${err.details?.availableMinutes} minutes.`);
      } else {
        Alert.alert('Error', err.message || 'Failed to submit selection');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Date</Text>
          <Text style={styles.dateText}>{serviceDate}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Priorities</Text>
          {selectedTasks.map((task, index) => (
            <View key={task.id} style={styles.taskRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.taskName}>{task.name}</Text>
            </View>
          ))}
          <Text style={styles.priorityHint}>Listed in the order you chose — top matters most.</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Confirm & Submit</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  section: { backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateText: { fontSize: 17, color: '#1a1a1a', fontWeight: '600' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  rankBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rankBadgeText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  taskName: { flex: 1, fontSize: 15, color: '#333' },
  priorityHint: { fontSize: 12, color: '#9ca3af', marginTop: 12 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16, flexDirection: 'row', gap: 12,
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  editBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#2563eb',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  editBtnText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 2, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
