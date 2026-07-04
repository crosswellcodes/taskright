import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  getTeamMembers,
  createTeamGroup,
  updateTeamGroup,
  setTeamGroupMembers,
  getTeamGroupWithMembers,
} from '../../api/businessApi';

export default function TeamGroupFormScreen({ route, navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const group = route.params?.group ?? null; // null = create mode, object = edit mode
  const isEdit = group !== null;

  const [groupName, setGroupName] = useState(group?.name ?? '');
  const [allMembers, setAllMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const membersData = await getTeamMembers(user.businessId);
      setAllMembers(membersData.teamMembers || []);

      if (isEdit) {
        const groupData = await getTeamGroupWithMembers(user.businessId, group.id);
        const ids = (groupData.group?.members || []).map(m => m.id);
        setSelectedIds(new Set(ids));
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [user.businessId, isEdit, group?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleMember = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      return Alert.alert('Error', 'Group name is required');
    }

    setSaving(true);
    try {
      const memberIds = Array.from(selectedIds);

      if (isEdit) {
        await updateTeamGroup(user.businessId, group.id, groupName.trim());
        await setTeamGroupMembers(user.businessId, group.id, memberIds);
      } else {
        const res = await createTeamGroup(user.businessId, groupName.trim());
        const newGroupId = res.group.id;
        if (memberIds.length > 0) {
          await setTeamGroupMembers(user.businessId, newGroupId, memberIds);
        }
      }

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Morning Crew"
          value={groupName}
          onChangeText={setGroupName}
        />

        <Text style={[styles.label, { marginTop: 24 }]}>Team Members</Text>
        <Text style={styles.hint}>Select who belongs to this group</Text>

        {allMembers.length === 0 ? (
          <Text style={styles.emptyText}>No team members yet. Add some in the Members tab first.</Text>
        ) : (
          <View style={styles.memberList}>
            {allMembers.map((member, index) => {
              const selected = selectedIds.has(member.id);
              return (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.memberRow,
                    index < allMembers.length - 1 && styles.memberRowBorder,
                  ]}
                  onPress={() => toggleMember(member.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberHours}>{member.weeklyHours} hrs/week</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Create Group'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  hint: { fontSize: 12, color: '#aaa', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fafafa',
  },
  emptyText: { fontSize: 14, color: '#aaa', marginTop: 8 },
  memberList: {
    borderWidth: 1, borderColor: '#eee', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff',
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
  },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db',
    marginRight: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkboxSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  memberHours: { fontSize: 13, color: '#888', marginTop: 2 },
  saveBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 32,
  },
  saveBtnDisabled: { backgroundColor: '#93c5fd' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: '#2563eb', fontSize: 15 },
});
