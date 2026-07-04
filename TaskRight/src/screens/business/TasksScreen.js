import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, Modal
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getTasks, createTask, updateTask, deleteTask } from '../../api/businessApi';

export default function TasksScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await getTasks(user.businessId);
      setTasks(data.tasks || []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.businessId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const openCreate = () => {
    setEditTask(null);
    setName('');
    setMinutes('');
    setModalVisible(true);
  };

  const openEdit = (task) => {
    setEditTask(task);
    setName(task.name);
    setMinutes(String(task.timeAllotmentMinutes));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name is required');
    const mins = parseInt(minutes);
    if (!mins || mins <= 0) return Alert.alert('Error', 'Enter valid minutes');

    setSaving(true);
    try {
      if (editTask) {
        await updateTask(user.businessId, editTask.id, { name: name.trim(), timeAllotmentMinutes: mins });
      } else {
        await createTask(user.businessId, { name: name.trim(), timeAllotmentMinutes: mins });
      }
      setModalVisible(false);
      fetchTasks();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (task) => {
    Alert.alert('Delete Task', `Delete "${task.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(user.businessId, task.id);
            fetchTasks();
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to delete task');
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
        data={tasks}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTasks(); }} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 + insets.bottom }}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No tasks yet.</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.taskName}>{item.name}</Text>
              <Text style={styles.taskTime}>{item.timeAllotmentMinutes} min</Text>
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
          <Text style={styles.fabText}>+ New Task</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{editTask ? 'Edit Task' : 'New Task'}</Text>

          <Text style={styles.label}>Task Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Vacuum living room" />

          <Text style={styles.label}>Time (minutes)</Text>
          <TextInput style={styles.input} value={minutes} onChangeText={setMinutes} placeholder="e.g. 30" keyboardType="number-pad" />

          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Task</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  cardLeft: { flex: 1 },
  taskName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  taskTime: { fontSize: 14, color: '#888' },
  actions: { flexDirection: 'row', gap: 8 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#eff6ff', borderRadius: 8 },
  editBtnText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fef2f2', borderRadius: 8 },
  deleteBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  fabBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modal: { flex: 1, padding: 24, backgroundColor: '#fff' },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 24 },
  label: { fontSize: 14, color: '#555', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fafafa' },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 32 },
  saveBtnDisabled: { backgroundColor: '#93c5fd' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', marginTop: 12 },
  cancelBtnText: { color: '#2563eb', fontSize: 15 },
});
