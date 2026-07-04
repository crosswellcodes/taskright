import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { addTeamMember } from '../../api/businessApi';
import { normalizePhone } from '../../utils/phoneUtils';

export default function AddTeamMemberScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [loading, setLoading] = useState(false);

  // Invite code modal
  const [modalVisible, setModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name is required');
    if (!phoneNumber.trim()) return Alert.alert('Error', 'Phone number is required');
    if (!weeklyHours.trim()) return Alert.alert('Error', 'Weekly hours is required');

    setLoading(true);
    try {
      const data = await addTeamMember(user.businessId, {
        name: name.trim(),
        phoneNumber: normalizePhone(phoneNumber),
        weeklyHours: parseInt(weeklyHours, 10),
      });
      // Show invite code modal before navigating away
      setInviteCode(data.teamMember?.inviteCode || '');
      setInviteName(name.trim());
      setInvitePhone(normalizePhone(phoneNumber));
      setModalVisible(true);
    } catch (err) {
      if (err.code === 'DUPLICATE_TEAM_MEMBER') {
        Alert.alert('Duplicate', 'A team member with this phone number already exists.');
      } else if (err.code === 'VALIDATION_ERROR') {
        Alert.alert('Validation Error', err.message || 'Please check your input and try again.');
      } else {
        Alert.alert('Error', err.message || 'Failed to add team member');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTextCode = () => {
    const message = `Hi ${inviteName}, you've been added to TaskRight! Your invite code is: ${inviteCode}. Download the app and use this code to accept your invite.`;
    const smsUrl = Platform.OS === 'ios'
      ? `sms:${invitePhone}&body=${encodeURIComponent(message)}`
      : `sms:${invitePhone}?body=${encodeURIComponent(message)}`;
    Linking.openURL(smsUrl).catch(() =>
      Alert.alert('Unable to open Messages', 'Please text the code manually.')
    );
  };

  const handleDone = () => {
    setModalVisible(false);
    navigation.goBack();
  };

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
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
            onPress={handleAdd}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Adding...' : 'Add Team Member'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Invite Code Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleDone}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Success icon */}
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>✓</Text>
            </View>

            <Text style={styles.modalTitle}>{inviteName} Added</Text>
            <Text style={styles.modalSub}>
              Share this invite code so they can accept their invite in the TaskRight app.
            </Text>

            {/* Code display */}
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <Text style={styles.codeValue}>{inviteCode}</Text>
            </View>

            {/* Text button */}
            <TouchableOpacity style={styles.textBtn} onPress={handleTextCode}>
              <Text style={styles.textBtnText}>Text this code to {inviteName}</Text>
            </TouchableOpacity>

            {/* Done button */}
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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

  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 28, width: '100%', maxWidth: 360, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  iconText: { fontSize: 26, color: '#059669' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  codeBox: {
    backgroundColor: '#eff6ff', borderRadius: 14, borderWidth: 2,
    borderColor: '#bfdbfe', paddingVertical: 18, paddingHorizontal: 32,
    alignItems: 'center', marginBottom: 24, width: '100%',
  },
  codeLabel: { fontSize: 11, fontWeight: '700', color: '#3b82f6', letterSpacing: 1.5, marginBottom: 6 },
  codeValue: { fontSize: 36, fontWeight: '800', color: '#1e40af', letterSpacing: 8 },

  textBtn: {
    backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1.5,
    borderColor: '#bbf7d0', paddingVertical: 13, paddingHorizontal: 20,
    width: '100%', alignItems: 'center', marginBottom: 12,
  },
  textBtnText: { fontSize: 15, fontWeight: '600', color: '#15803d' },

  doneBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 13, width: '100%', alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
