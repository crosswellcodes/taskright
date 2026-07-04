import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { addCustomer } from '../../api/businessApi';

export default function AddCustomerScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Customer name is required');
    if (!phoneNumber.trim()) return Alert.alert('Error', 'Phone number is required');

    setLoading(true);
    try {
      const fullPhone = '+1' + phoneNumber.replace(/\D/g, '');
      await addCustomer(user.businessId, { name: name.trim(), phoneNumber: fullPhone });
      navigation.goBack();
    } catch (err) {
      if (err.code === 'DUPLICATE_CUSTOMER') {
        Alert.alert('Duplicate', 'A customer with this phone number already exists.');
      } else if (err.code === 'VALIDATION_ERROR') {
        Alert.alert('Invalid Phone', 'Enter a valid 10-digit US phone number.');
      } else {
        Alert.alert('Error', err.message || 'Failed to add customer');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <Text style={styles.label}>Customer Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Jane Smith"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.phoneRow}>
          <View style={styles.phonePrefix}>
            <Text style={styles.phonePrefixText}>+1</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="(333) 000-1111"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            maxLength={14}
          />
        </View>

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleAdd} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Adding...' : 'Add Customer'}</Text>
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
  phoneRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, backgroundColor: '#fafafa', overflow: 'hidden' },
  phonePrefix: { paddingHorizontal: 12, paddingVertical: 12, borderRightWidth: 1, borderRightColor: '#ddd', backgroundColor: '#f0f0f0' },
  phonePrefixText: { fontSize: 16, color: '#333', fontWeight: '500' },
  phoneInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 32 },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
