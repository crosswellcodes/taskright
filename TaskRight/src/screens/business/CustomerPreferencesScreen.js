import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getCustomerDetails, updateCustomerDetails } from '../../api/businessApi';
import { formatPhone } from '../../utils/phoneUtils';
import MapboxAddressInput from '../../components/MapboxAddressInput';

export default function CustomerPreferencesScreen({ route, navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { customerId, customerName } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const fetchDetails = useCallback(async () => {
    try {
      const data = await getCustomerDetails(user.businessId, customerId);
      const c = data.customer;
      setPhone(c.phoneNumber || '');
      setEmail(c.email || '');
      setAddress(c.address || '');
      setNotes(c.notes || '');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load customer details');
    } finally {
      setLoading(false);
    }
  }, [user.businessId, customerId]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const handlePhoneContact = () => {
    Alert.alert(customerName, phone, [
      { text: 'Call', onPress: () => Linking.openURL(`tel:${phone}`) },
      { text: 'Text', onPress: () => Linking.openURL(`sms:${phone}`) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSendEmail = () => {
    Linking.openURL(`mailto:${email.trim()}`);
  };

  const handleGetDirections = () => {
    const encoded = encodeURIComponent(address.trim());
    Linking.openURL(`maps://?daddr=${encoded}`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCustomerDetails(user.businessId, customerId, {
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.customerHeader}>
          <Text style={styles.customerName}>{customerName}</Text>
          <Text style={styles.headerSub}>Customer Preferences & Details</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Phone Number</Text>
          <TouchableOpacity style={styles.phoneRow} onPress={handlePhoneContact}>
            <Text style={styles.phoneText}>{formatPhone(phone)}</Text>
            <Text style={styles.phoneHint}>Tap to call or text</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. customer@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {email.trim() ? (
              <TouchableOpacity onPress={handleSendEmail} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.emailHint}>Tap to send email</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.label}>Service Address</Text>
          <MapboxAddressInput
            value={address}
            onChangeText={setAddress}
            placeholder="Start typing a street address..."
          />

          {address.trim() ? (
            <TouchableOpacity style={styles.directionsBtn} onPress={handleGetDirections}>
              <Text style={styles.directionsBtnText}>Get Directions</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.label}>Preferences & Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Has a dog, prefers eco-friendly products, gate code is 1234"
            multiline
            numberOfLines={5}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Details</Text>
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
  flex: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  customerHeader: {
    backgroundColor: '#2563eb', borderRadius: 12,
    padding: 16, marginBottom: 20,
  },
  customerName: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 2 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  section: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginBottom: 20,
    overflow: 'visible',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 16 },
  phoneRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fafafa',
  },
  phoneText: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  phoneHint: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, backgroundColor: '#fafafa', color: '#1a1a1a',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, backgroundColor: '#fafafa',
  },
  inputFlex: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1a1a1a' },
  emailHint: { fontSize: 12, color: '#2563eb', fontWeight: '500', marginLeft: 8 },
  notesInput: { minHeight: 110, textAlignVertical: 'top' },
  directionsBtn: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#16a34a',
    borderRadius: 10, paddingVertical: 10,
  },
  directionsBtnText: { color: '#16a34a', fontSize: 14, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  saveBtnDisabled: { backgroundColor: '#93c5fd' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: '#2563eb', fontSize: 15 },
});
