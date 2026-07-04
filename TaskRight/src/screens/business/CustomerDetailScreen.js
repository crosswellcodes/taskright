import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getCustomerDetails, markServiceComplete, getLatestCustomerFeedback } from '../../api/businessApi';
import { formatPhone } from '../../utils/phoneUtils';

export default function CustomerDetailScreen({ route, navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { customerId } = route.params;
  const [customer, setCustomer] = useState(null);
  const [latestFeedback, setLatestFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchCustomer = useCallback(async () => {
    try {
      const data = await getCustomerDetails(user.businessId, customerId);
      setCustomer(data.customer);
      // Fetch latest feedback separately — 404 just means no feedback yet
      try {
        const fb = await getLatestCustomerFeedback(user.businessId, customerId);
        setLatestFeedback(fb.feedback || null);
      } catch {
        setLatestFeedback(null);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load customer');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.businessId, customerId]);

  useFocusEffect(
    useCallback(() => { fetchCustomer(); }, [fetchCustomer])
  );

  const handleMarkComplete = async () => {
    Alert.alert(
      'Mark Service Complete',
      'This will close the current selection cycle and generate the next one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setCompleting(true);
            try {
              await markServiceComplete(user.businessId, customerId);
              await fetchCustomer();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to mark complete');
            } finally {
              setCompleting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (!customer) return null;

  const lastSel = customer.lastSelection;

  const handleGetDirections = () => {
    if (!customer.address) return;
    const encoded = encodeURIComponent(customer.address);
    Linking.openURL(`maps://?daddr=${encoded}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCustomer(); }} />}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{customer.name}</Text>
            <Text style={styles.phone}>{formatPhone(customer.phoneNumber)}</Text>
          </View>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => navigation.navigate('CustomerPreferences', { customerId, customerName: customer.name })}
          >
            <Text style={styles.detailsBtnText}>Details</Text>
          </TouchableOpacity>
        </View>
        {customer.address ? (
          <TouchableOpacity style={styles.directionsBtn} onPress={handleGetDirections}>
            <Text style={styles.directionsAddress} numberOfLines={1}>{customer.address}</Text>
            <Text style={styles.directionsBtnText}>Get Directions →</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Assigned Cycles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assigned Cycles</Text>
        {customer.assignedCycles?.length === 0 ? (
          <Text style={styles.emptyText}>No cycles assigned.</Text>
        ) : (
          customer.assignedCycles?.map(c => (
            <View key={c.id} style={styles.row}>
              <Text style={styles.rowLabel}>{c.serviceCycleName || `Cycle #${c.serviceCycleId}`}</Text>
              <Text style={styles.rowValue}>{c.totalHours}h / visit</Text>
            </View>
          ))
        )}
        <TouchableOpacity
          style={styles.assignBtn}
          onPress={() => navigation.navigate('AssignCycle', { customerId, customerName: customer.name })}
        >
          <Text style={styles.assignBtnText}>+ Assign Cycle</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Feedback */}
      {latestFeedback ? (
        <TouchableOpacity
          style={styles.section}
          onPress={() => navigation.navigate('CustomerFeedbackDetail', { feedback: latestFeedback })}
          activeOpacity={0.85}
        >
          <Text style={styles.sectionTitle}>Recent Feedback</Text>
          <Text style={styles.feedbackDate}>
            {new Date(latestFeedback.serviceDate).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            })}
          </Text>
          {latestFeedback.feedbackText ? (
            <Text style={styles.feedbackPreview} numberOfLines={2}>{latestFeedback.feedbackText}</Text>
          ) : (
            <Text style={styles.feedbackNoText}>No comments left</Text>
          )}
          {latestFeedback.photoFilenames?.length > 0 && (
            <Text style={styles.feedbackMeta}>
              {latestFeedback.photoFilenames.length} photo{latestFeedback.photoFilenames.length !== 1 ? 's' : ''}
            </Text>
          )}
          <Text style={styles.feedbackChevron}>View full feedback →</Text>
        </TouchableOpacity>
      ) : null}

      {/* Messages */}
      <TouchableOpacity
        style={styles.section}
        onPress={() => navigation.navigate('MessageThread', {
          customerId,
          customerName: customer.name,
          customerPhone: customer.phoneNumber,
        })}
        activeOpacity={0.85}
      >
        <Text style={styles.sectionTitle}>Messages</Text>
        <Text style={styles.viewThreadLink}>View SMS thread →</Text>
      </TouchableOpacity>

      {/* Last Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last Selection</Text>
        {lastSel ? (
          <>
            <Text style={styles.rowLabel}>{lastSel.selectedTasks?.length || 0} tasks selected</Text>
            <Text style={styles.rowValue}>Status: {lastSel.status}</Text>
          </>
        ) : (
          <Text style={styles.emptyText}>No selections yet.</Text>
        )}
      </View>

      {/* Upcoming Services */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Services</Text>
        {(customer.upcomingServices || []).length === 0 ? (
          <Text style={styles.emptyText}>None scheduled.</Text>
        ) : (
          customer.upcomingServices.map((s, idx) => {
            const date = new Date(s.serviceDate).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric'
            });
            return (
              <TouchableOpacity
                key={idx}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ServiceCallDetail', {
                  selectionCycleId: s.id,
                  serviceDate: s.serviceDate,
                  status: s.status,
                  serviceCycleName: s.serviceCycleName ?? '',
                  submissionDeadline: s.submissionDeadline,
                  customerName: customer.name,
                })}
              >
                <Text style={styles.rowLabel}>{date}</Text>
                <View style={styles.rowRight}>
                  <View style={[styles.badge, s.status === 'open' ? styles.badgeOpen : styles.badgeCompleted]}>
                    <Text style={styles.badgeText}>{s.status}</Text>
                  </View>
                  <Text style={styles.rowChevron}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <TouchableOpacity
        style={[styles.completeBtn, completing && styles.completeBtnDisabled]}
        onPress={handleMarkComplete}
        disabled={completing}
      >
        {completing
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.completeBtnText}>Mark Service Complete</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#2563eb', padding: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerInfo: { flex: 1, marginRight: 12 },
  name: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  phone: { fontSize: 15, color: 'rgba(255,255,255,0.8)' },
  detailsBtn: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  detailsBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  directionsBtn: {
    marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8, padding: 10,
  },
  directionsAddress: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  directionsBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  section: { backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowChevron: { fontSize: 18, color: '#c7d2fe', fontWeight: '400' },
  rowLabel: { fontSize: 15, color: '#333' },
  rowValue: { fontSize: 14, color: '#888' },
  emptyText: { fontSize: 14, color: '#aaa' },
  assignBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#2563eb', alignItems: 'center' },
  assignBtnText: { color: '#2563eb', fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeOpen: { backgroundColor: '#dbeafe' },
  badgeCompleted: { backgroundColor: '#d1fae5' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#374151', textTransform: 'capitalize' },
  feedbackDate: { fontSize: 13, color: '#888', marginBottom: 6 },
  feedbackPreview: { fontSize: 15, color: '#333', marginBottom: 6 },
  feedbackNoText: { fontSize: 14, color: '#aaa', fontStyle: 'italic', marginBottom: 6 },
  feedbackMeta: { fontSize: 13, color: '#2563eb', marginBottom: 4 },
  feedbackChevron: { fontSize: 13, color: '#2563eb', marginTop: 6, fontWeight: '500' },
  completeBtn: {
    backgroundColor: '#10b981', margin: 16, marginTop: 24, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 32,
  },
  completeBtnDisabled: { backgroundColor: '#6ee7b7' },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  viewThreadLink: { fontSize: 14, color: '#2563eb', fontWeight: '500', marginTop: 2 },
});
