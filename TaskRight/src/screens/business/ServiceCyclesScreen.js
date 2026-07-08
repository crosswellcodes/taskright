import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, Modal
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  getServiceCycles, createServiceCycle, updateServiceCycle,
  deleteServiceCycle, getTasks
} from '../../api/businessApi';

const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'yearly'];

export default function ServiceCyclesScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [cycles, setCycles] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editCycle, setEditCycle] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [cycleName, setCycleName] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [daysBeforeDeadline, setDaysBeforeDeadline] = useState('3');
  const [daysBeforeRepeat, setDaysBeforeRepeat] = useState('1');
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [cycleData, taskData] = await Promise.all([
        getServiceCycles(user.businessId),
        getTasks(user.businessId),
      ]);
      setCycles(cycleData.serviceCycles || []);
      setAllTasks(taskData.tasks || []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.businessId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchData);
    return unsubscribe;
  }, [navigation, fetchData]);

  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const openCreate = () => {
    setEditCycle(null);
    setCycleName('');
    setFrequency('weekly');
    setDaysBeforeDeadline('3');
    setDaysBeforeRepeat('1');
    setSelectedTaskIds([]);
    setModalVisible(true);
  };

  const openEdit = (cycle) => {
    setEditCycle(cycle);
    setCycleName(cycle.name);
    setFrequency(cycle.frequency);
    setDaysBeforeDeadline(String(cycle.daysBeforeServiceDeadline));
    setDaysBeforeRepeat(String(cycle.daysBeforeAutoRepeat));
    setSelectedTaskIds(cycle.assignedTasks || []);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!cycleName.trim()) return Alert.alert('Error', 'Template name is required');
    setSaving(true);
    try {
      const payload = {
        name: cycleName.trim(),
        frequency,
        daysBeforeServiceDeadline: parseInt(daysBeforeDeadline) || 3,
        daysBeforeAutoRepeat: parseInt(daysBeforeRepeat) || 1,
        taskIds: selectedTaskIds,
      };
      if (editCycle) {
        await updateServiceCycle(user.businessId, editCycle.id, payload);
      } else {
        await createServiceCycle(user.businessId, payload);
      }
      setModalVisible(false);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cycle) => {
    Alert.alert('Delete Template', `Delete "${cycle.name}"? Existing customer services are unaffected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteServiceCycle(user.businessId, cycle.id);
            fetchData();
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to delete template');
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <View style={styles.container}>
      <FlatList
        data={cycles}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 + insets.bottom }}
        ListHeaderComponent={
          <Text style={styles.introText}>
            Templates are reusable service blueprints. Start a customer's service from one to
            save time — the customer's service is a separate copy afterward, so editing a
            template never changes existing services.
          </Text>
        }
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No templates yet.</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.cycleName}>{item.name}</Text>
              <Text style={styles.cycleFreq}>{item.frequency} · {item.assignedTasks?.length || 0} tasks</Text>
              <Text style={styles.cycleDays}>
                Selection deadline: {item.daysBeforeServiceDeadline}d before service
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <View style={[styles.fab, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.fabBtn} onPress={openCreate}>
          <Text style={styles.fabText}>+ New Template</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <FlatList
          style={styles.modal}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <>
              <Text style={styles.modalTitle}>{editCycle ? 'Edit Template' : 'New Template'}</Text>

              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={cycleName} onChangeText={setCycleName} placeholder="e.g. Weekly Cleaning" />

              <Text style={styles.label}>Frequency</Text>
              <View style={styles.freqRow}>
                {FREQUENCIES.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.freqBtn, frequency === f && styles.freqBtnSelected]}
                    onPress={() => setFrequency(f)}
                  >
                    <Text style={[styles.freqBtnText, frequency === f && styles.freqBtnTextSelected]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Days before service (selection deadline)</Text>
              <TextInput style={styles.input} value={daysBeforeDeadline} onChangeText={setDaysBeforeDeadline} keyboardType="number-pad" placeholder="3" />

              <Text style={styles.label}>Days before service (auto-repeat)</Text>
              <TextInput style={styles.input} value={daysBeforeRepeat} onChangeText={setDaysBeforeRepeat} keyboardType="number-pad" placeholder="1" />

              <Text style={styles.label}>Tasks (optional)</Text>
            </>
          }
          data={allTasks}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => {
            const isSelected = selectedTaskIds.includes(item.id);
            return (
              <TouchableOpacity
                style={[styles.taskOption, isSelected && styles.taskOptionSelected]}
                onPress={() => toggleTaskSelection(item.id)}
              >
                <Text style={[styles.taskOptionName, isSelected && styles.taskOptionNameSelected]}>{item.name}</Text>
                <Text style={styles.taskOptionTime}>{item.timeAllotmentMinutes} min</Text>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <>
              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editCycle ? 'Save Changes' : 'Create Template'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          }
        />
      </Modal>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#888' },
  introText: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  cardLeft: { flex: 1 },
  cycleName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  cycleFreq: { fontSize: 14, color: '#555', marginBottom: 2, textTransform: 'capitalize' },
  cycleDays: { fontSize: 13, color: '#aaa' },
  actions: { flexDirection: 'row', gap: 8 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#eff6ff', borderRadius: 8 },
  editBtnText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fef2f2', borderRadius: 8 },
  deleteBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  fabBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 24 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  label: { fontSize: 14, color: '#555', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fafafa' },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqBtn: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  freqBtnSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  freqBtnText: { color: '#555', fontSize: 14 },
  freqBtnTextSelected: { color: '#2563eb', fontWeight: '600' },
  taskOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderWidth: 1.5, borderColor: '#eee', borderRadius: 10, marginBottom: 6 },
  taskOptionSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  taskOptionName: { fontSize: 15, color: '#333' },
  taskOptionNameSelected: { color: '#2563eb', fontWeight: '600' },
  taskOptionTime: { fontSize: 13, color: '#888' },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { backgroundColor: '#93c5fd' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', marginTop: 12 },
  cancelBtnText: { color: '#2563eb', fontSize: 15 },
});
