import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { updateTeamMember } from '../../api/businessApi';
import { normalizePhone, displayPhone } from '../../utils/phoneUtils';

export default function EditTeamMemberScreen({ route, navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { member } = route.params; // { id, name, phoneNumber, weeklyHours }

  const [name, setName] = useState(member.name || '');
  const [phoneNumber, setPhoneNumber] = useState(displayPhone(member.phoneNumber));
  const [weeklyHours, setWeeklyHours] = useState(String(member.weeklyHours ?? ''));
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name is required');
    if (!phoneNumber.trim()) return Alert.alert('Error', 'Phone number is required');
    if (!weeklyHours.trim()) return Alert.alert('Error', 'Weekly hours is required');

    setLoading(true);
    try {
      await updateTeamMember(user.businessId, member.id, {
        name: name.trim(),
        phoneNumber: normalizePhone(phoneNumber),
        weeklyHours: parseInt(weeklyHours, 10),
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update team member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Alex Johnson"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="1 (333) 000-1111"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Weekly Hours Available</Text>
        <TextInput
          style={styles.input}
          placeholder="40"
          value={weeklyHours}
          onChangeText={setWeeklyHours}
          keyboardType="numeric"
        />
        <Text style={styles.hint}>Maximum hours this team member can work per week</Text>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  label: { fontSize: 14, color: '#555', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fafafa',
  },
  hint: { fontSize: 12, color: '#aaa', marginTop: 4 },
  btn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 32,
  },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
