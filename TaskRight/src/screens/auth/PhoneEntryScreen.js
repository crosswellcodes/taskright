import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { businessLogin, businessSignup, customerLogin, teamMemberLogin, teamMemberAcceptInvite } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { normalizePhone } from '../../utils/phoneUtils';

export default function PhoneEntryScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState('select'); // 'select' | 'business' | 'customer' | 'signup' | 'team_member' | 'team_member_invite'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [schedulingFormat, setSchedulingFormat] = useState('date_based');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const goBack = () => {
    setPhoneNumber('');
    setBusinessName('');
    setSchedulingFormat('date_based');
    setInviteCode('');
    setMode('select');
  };

  const handleBusinessLogin = async () => {
    if (!phoneNumber.trim()) return Alert.alert('Error', 'Enter your phone number');
    setLoading(true);
    try {
      const data = await businessLogin(normalizePhone(phoneNumber));
      await login(data.token, {
        type: 'business',
        businessId: data.business.id,
        name: data.business.name,
        schedulingFormat: data.business.schedulingFormat,
      });
    } catch (err) {
      if (err.status === 404) {
        setMode('signup'); // phone not found — slide into signup with number pre-filled
      } else {
        Alert.alert('Error', err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessSignup = async () => {
    if (!phoneNumber.trim()) return Alert.alert('Error', 'Enter your phone number');
    if (!businessName.trim()) return Alert.alert('Error', 'Enter your business name');
    setLoading(true);
    try {
      const data = await businessSignup(businessName.trim(), normalizePhone(phoneNumber), schedulingFormat);
      await login(data.token, {
        type: 'business',
        businessId: data.business.id,
        name: data.business.name,
        schedulingFormat: data.business.schedulingFormat,
      });
    } catch (err) {
      Alert.alert('Error', err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerLogin = async () => {
    if (!phoneNumber.trim()) return Alert.alert('Error', 'Enter your phone number');
    setLoading(true);
    try {
      const data = await customerLogin(normalizePhone(phoneNumber));
      await login(data.token, { type: 'customer', customerId: data.customer.id, name: data.customer.name });
    } catch (err) {
      if (err.status === 404) {
        Alert.alert('Not Found', 'No account found for this phone number. Ask your service provider to add you.');
      } else {
        Alert.alert('Error', err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTeamMemberLogin = async () => {
    if (!phoneNumber.trim()) return Alert.alert('Error', 'Enter your phone number');
    setLoading(true);
    try {
      const data = await teamMemberLogin(normalizePhone(phoneNumber));
      await login(data.token, {
        type: 'team_member',
        teamMemberId: data.teamMember.id,
        businessId: data.teamMember.businessId,
        name: data.teamMember.name,
      });
    } catch (err) {
      if (err.status === 403) {
        // Invite not yet accepted — guide them to accept first
        setMode('team_member_invite');
      } else if (err.status === 404) {
        Alert.alert('Not Found', 'No team member account found for this number. Check with your business owner.');
      } else {
        Alert.alert('Error', err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTeamMemberAcceptInvite = async () => {
    if (!phoneNumber.trim()) return Alert.alert('Error', 'Enter your phone number');
    if (!inviteCode.trim()) return Alert.alert('Error', 'Enter your invite code');
    setLoading(true);
    try {
      const data = await teamMemberAcceptInvite(normalizePhone(phoneNumber), inviteCode.trim());
      await login(data.token, {
        type: 'team_member',
        teamMemberId: data.teamMember.id,
        businessId: data.teamMember.businessId,
        name: data.teamMember.name,
      });
    } catch (err) {
      if (err.status === 401) {
        Alert.alert('Invalid Code', 'That invite code is incorrect. Check with your business owner.');
      } else if (err.status === 409) {
        // Already accepted — redirect to regular login
        setInviteCode('');
        setMode('team_member');
        Alert.alert('Already Activated', 'Your account is already set up. Log in with your phone number.');
      } else if (err.status === 404) {
        Alert.alert('Not Found', 'No team member account found for this number.');
      } else {
        Alert.alert('Error', err.message || 'Could not accept invite');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Landing screen ───────────────────────────────────────────────────────

  if (mode === 'select') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.landingContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Branding */}
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>TaskRight</Text>
            <Text style={styles.brandSubtitle}>Service management made simple</Text>
          </View>

          {/* Business Owner card */}
          <View style={styles.roleCard}>
            <Text style={styles.roleTitle}>Business Owner</Text>
            <Text style={styles.roleDesc}>
              Manage your customers, team, and service schedules
            </Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={styles.roleLoginBtn}
                onPress={() => setMode('business')}
              >
                <Text style={styles.roleLoginText}>Log In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.roleSignupBtn}
                onPress={() => {
                  setPhoneNumber('');
                  setBusinessName('');
                  setMode('signup');
                }}
              >
                <Text style={styles.roleSignupText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Customer card */}
          <View style={styles.roleCard}>
            <Text style={styles.roleTitle}>Customer</Text>
            <Text style={styles.roleDesc}>
              View your upcoming service and choose your tasks
            </Text>
            <TouchableOpacity
              style={styles.roleLoginBtn}
              onPress={() => setMode('customer')}
            >
              <Text style={styles.roleLoginText}>Log In</Text>
            </TouchableOpacity>
            <Text style={styles.roleNote}>
              Your account is set up by your service provider
            </Text>
          </View>

          {/* Team Member card */}
          <View style={styles.roleCard}>
            <Text style={styles.roleTitle}>Team Member</Text>
            <Text style={styles.roleDesc}>
              View your assigned jobs and service details
            </Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={styles.roleLoginBtn}
                onPress={() => setMode('team_member')}
              >
                <Text style={styles.roleLoginText}>Log In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.roleSignupBtn}
                onPress={() => setMode('team_member_invite')}
              >
                <Text style={styles.roleSignupText}>Accept Invite</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.roleNote}>
              Your account is created by your business owner
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Business signup ──────────────────────────────────────────────────────

  if (mode === 'signup') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formTitle}>Create Your Account</Text>
            <Text style={styles.formSubtitle}>
              Set up your business on TaskRight
            </Text>

            <Text style={styles.label}>Business Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sparkle Cleaning Co."
              value={businessName}
              onChangeText={setBusinessName}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="1 (333) 000-1111"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Scheduling Format</Text>
            <View style={styles.formatToggle}>
              {[
                { key: 'date_based', label: 'Date-based' },
                { key: 'day_of_week', label: 'Day of week' },
              ].map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.formatBtn, schedulingFormat === key && styles.formatBtnActive]}
                  onPress={() => setSchedulingFormat(key)}
                >
                  <Text style={[styles.formatBtnText, schedulingFormat === key && styles.formatBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.formatHint}>
              {schedulingFormat === 'date_based'
                ? 'e.g. every month on the 15th'
                : 'e.g. every Thursday'}
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleBusinessSignup}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={goBack}>
              <Text style={styles.linkText}>Back to Home</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Team member accept invite ────────────────────────────────────────────

  if (mode === 'team_member_invite') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formTitle}>Accept Your Invite</Text>
            <Text style={styles.formSubtitle}>
              Enter the phone number and invite code your business owner shared with you
            </Text>

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="1 (333) 000-1111"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoFocus
            />

            <Text style={styles.label}>Invite Code</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              value={inviteCode}
              onChangeText={setInviteCode}
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleTeamMemberAcceptInvite}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Activating...' : 'Activate Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={goBack}>
              <Text style={styles.linkText}>Back to Home</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Team member login ────────────────────────────────────────────────────

  if (mode === 'team_member') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formTitle}>Team Member Login</Text>
            <Text style={styles.formSubtitle}>
              Enter the phone number on your account
            </Text>

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="1 (333) 000-1111"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoFocus
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleTeamMemberLogin}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Logging in...' : 'Continue'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => { setPhoneNumber(''); setMode('team_member_invite'); }}
            >
              <Text style={styles.secondaryBtnText}>Accept an Invite Instead</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={goBack}>
              <Text style={styles.linkText}>Back to Home</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Login screens (business or customer) ────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.formTitle}>
            {mode === 'business' ? 'Business Login' : 'Customer Login'}
          </Text>
          <Text style={styles.formSubtitle}>
            {mode === 'business'
              ? 'Enter your business phone number'
              : 'Enter the phone number on your account'}
          </Text>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="1 (333) 000-1111"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoFocus
          />

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={mode === 'business' ? handleBusinessLogin : handleCustomerLogin}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? 'Logging in...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          {/* Business login page also offers direct signup path */}
          {mode === 'business' && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setPhoneNumber('');
                setMode('signup');
              }}
            >
              <Text style={styles.secondaryBtnText}>Create a New Account</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.linkBtn} onPress={goBack}>
            <Text style={styles.linkText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f4ff' },

  // ── Landing ───────────────────────────────────────────────────────────────
  landingContent: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 48,
  },
  brand: { alignItems: 'center', marginBottom: 40 },
  brandTitle: {
    fontSize: 42, fontWeight: '800', color: '#2563eb', letterSpacing: -1,
  },
  brandSubtitle: {
    fontSize: 16, color: '#64748b', marginTop: 8, textAlign: 'center',
  },
  roleCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  roleTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  roleDesc: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 16 },
  roleButtons: { flexDirection: 'row', gap: 10 },
  roleLoginBtn: {
    flex: 1, backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  roleLoginText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  roleSignupBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff',
  },
  roleSignupText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  roleNote: {
    fontSize: 12, color: '#94a3b8', marginTop: 12, textAlign: 'center',
  },

  // ── Forms ─────────────────────────────────────────────────────────────────
  formContent: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 48,
  },
  formTitle: {
    fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 15, color: '#64748b', marginBottom: 32, lineHeight: 22,
  },
  label: { fontSize: 14, color: '#555', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, backgroundColor: '#fff',
  },
  primaryBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 24,
  },
  primaryBtnDisabled: { backgroundColor: '#93c5fd' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: '#fff',
  },
  secondaryBtnText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#2563eb', fontSize: 15 },

  // Scheduling format toggle
  formatToggle: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  formatBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff',
  },
  formatBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  formatBtnText: { fontSize: 14, fontWeight: '500', color: '#555' },
  formatBtnTextActive: { color: '#2563eb', fontWeight: '600' },
  formatHint: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
});
