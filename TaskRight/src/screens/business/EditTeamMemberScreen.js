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
  const { member } = route.params; // { id, name, phoneNumber, weeklyHours, hourlyRate }

  const [name, setName] = useState(member.name || '');
  const [phoneNumber, setPhoneNumber] = useState(displayPhone(member.phoneNumber));
  const [weeklyHours, setWeeklyHours] = useState(String(member.weeklyHours ?? ''));
  const [hourlyRate, setHourlyRate] = useState(member.hourlyRate != null ? String(member.hourlyRate) : '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name is required');
    if (!phoneNumber.trim()) return Alert.alert('Error', 'Phone number is required');
    if (!weeklyHours.trim()) return Alert.alert('Error', 'Weekly hours is required');

    // Hourly rate is optional; blank clears it. Validate when present.
    let rate = null;
    if (hourlyRate.trim() !== '') {
      rate = parseFloat(hourlyRate);
      if (Number.isNaN(rate) || rate < 0) return Alert.alert('Error', 'Enter a valid hourly rate, or leave it blank');
    }

    setLoading(true);
    try {
      await updateTeamMember(user.businessId, member.id, {
        name: name.trim(),
        phoneNumber: normalizePhone(phoneNumber),
        weeklyHours: parseInt(weeklyHours, 10),
        hourlyRate: rate,
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

        <Text style={styles.label}>Hourly Rate (optional)</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountPrefix}>$</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            keyboardType="decimal-pad"
          />
        </View>
        <Text style={styles.hint}>Used to auto-calculate labor cost in job profitability. Leave blank if unknown.</Text>

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
  amountRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#fafafa' },
  amountPrefix: { fontSize: 16, color: '#6b7280', marginRight: 4 },
  amountInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  btn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 32,
  },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
