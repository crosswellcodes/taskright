import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Linking, Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  getCustomerDetails, markServiceComplete, getLatestCustomerFeedback,
  getCustomerProfitability, updateCustomerDetails,
} from '../../api/businessApi';
import { formatPhone } from '../../utils/phoneUtils';
import { frequencyLabel } from '../../utils/frequency';

function money(n) {
  if (n === null || n === undefined || n === '') return '—';
  return `$${Number(n).toFixed(2)}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const s = String(dateStr).split('T')[0];
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function CustomerDetailScreen({ route, navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { customerId } = route.params;
  const [customer, setCustomer] = useState(null);
  const [latestFeedback, setLatestFeedback] = useState(null);
  const [profitability, setProfitability] = useState(null);
  const [profitExpanded, setProfitExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [savingOptOut, setSavingOptOut] = useState(false);

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
      // Profitability aggregates COMPLETED cycles only — non-blocking supplement.
      try {
        const prof = await getCustomerProfitability(user.businessId, customerId);
        setProfitability(prof.profitability || null);
      } catch {
        setProfitability(null);
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

  // Open the Service builder to edit an existing Service (name/frequency/tasks/
  // hours/deadline/price all editable there — the price field feeds D2).
  function openServiceEditor(service) {
    navigation.navigate('AssignCycle', {
      customerId,
      customerName: customer.name,
      serviceId: service.id,
      serviceName: service.serviceCycleName,
    });
  }

  // Optimistic toggle: flip the flag immediately, PATCH, roll back on failure.
  async function handleToggleOptOut(value) {
    setSavingOptOut(true);
    setCustomer(prev => ({ ...prev, reviewRequestsOptedOut: value }));
    try {
      await updateCustomerDetails(user.businessId, customerId, { reviewRequestsOptedOut: value });
    } catch (err) {
      setCustomer(prev => ({ ...prev, reviewRequestsOptedOut: !value }));
      Alert.alert('Error', err.message || 'Failed to update review setting');
    } finally {
      setSavingOptOut(false);
    }
  }

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
    <>
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
        {customer.geocodeStatus === 'failed' ? (
          <Text style={styles.geocodeWarning}>
            ⚠ We couldn't map this address for automatic clock-in
            {customer.geocodeRelevance != null ? ' (closest match wasn’t confident)' : ''}
            . Check the address in Details.
          </Text>
        ) : null}
      </View>

      {/* Profitability (COMPLETED cycles only) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profitability</Text>
        {profitability && profitability.completedJobCount > 0 ? (
          <TouchableOpacity activeOpacity={0.7} onPress={() => setProfitExpanded(v => !v)}>
            <View style={styles.profitGrid}>
              <View style={styles.profitCell}>
                <Text style={styles.profitCellLabel}>Revenue</Text>
                <Text style={styles.profitCellValue}>{money(profitability.totalRevenue)}</Text>
              </View>
              <View style={styles.profitCell}>
                <Text style={styles.profitCellLabel}>Cost</Text>
                <Text style={styles.profitCellValue}>{money(profitability.totalCost)}</Text>
              </View>
              <View style={styles.profitCell}>
                <Text style={styles.profitCellLabel}>Margin</Text>
                <Text style={[
                  styles.profitCellValue,
                  Number(profitability.totalMarginDollars) < 0 ? styles.marginNegative : styles.marginPositive,
                ]}>
                  {money(profitability.totalMarginDollars)}
                </Text>
              </View>
              <View style={styles.profitCell}>
                <Text style={styles.profitCellLabel}>Margin %</Text>
                <Text style={[
                  styles.profitCellValue,
                  Number(profitability.totalMarginDollars) < 0 ? styles.marginNegative : styles.marginPositive,
                ]}>
                  {profitability.totalMarginPercent === null || profitability.totalMarginPercent === undefined
                    ? '—'
                    : `${Number(profitability.totalMarginPercent).toFixed(1)}%`}
                </Text>
              </View>
            </View>
            <View style={styles.profitFooter}>
              <Text style={styles.profitJobCount}>
                {profitability.completedJobCount} completed job{profitability.completedJobCount !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.profitExpandLink}>
                {profitExpanded ? 'Hide breakdown ▲' : 'View breakdown ▼'}
              </Text>
            </View>

            {profitExpanded && (
              <View style={styles.profitBreakdown}>
                {profitability.jobs.map((job) => (
                  <View key={job.selectionCycleId} style={styles.profitJobRow}>
                    <View style={styles.profitJobLeft}>
                      <Text style={styles.profitJobDate}>{formatShortDate(job.serviceDate)}</Text>
                      <Text style={styles.profitJobRef}>Ref #{job.selectionCycleId}</Text>
                    </View>
                    <View style={styles.profitJobRight}>
                      <Text style={styles.profitJobPriceCost}>
                        {money(job.price)} − {money(job.totalCost)}
                      </Text>
                      <Text style={[
                        styles.profitJobMargin,
                        job.marginDollars === null || job.marginDollars === undefined
                          ? styles.marginUnset
                          : Number(job.marginDollars) < 0 ? styles.marginNegative : styles.marginPositive,
                      ]}>
                        {job.marginDollars === null || job.marginDollars === undefined
                          ? 'No price'
                          : money(job.marginDollars)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <Text style={styles.emptyText}>No completed jobs yet. Profitability appears once a service call is marked complete.</Text>
        )}
      </View>

      {/* Services */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Services</Text>
        {customer.assignedCycles?.length === 0 ? (
          <Text style={styles.emptyText}>No services yet.</Text>
        ) : (
          customer.assignedCycles?.map(c => {
            const hasPrice = c.pricePerVisit !== null && c.pricePerVisit !== undefined;
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.row}
                activeOpacity={0.6}
                onPress={() => openServiceEditor(c)}
              >
                <View style={styles.cycleInfo}>
                  <Text style={styles.rowLabel}>{c.serviceCycleName || `Service #${c.id}`}</Text>
                  <Text style={[styles.cyclePrice, !hasPrice && styles.cyclePriceUnset]}>
                    {hasPrice ? `${money(c.pricePerVisit)} / visit` : 'No recurring price'}
                    {c.frequency ? `  ·  ${frequencyLabel(c.frequency)}` : ''}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue}>{c.totalHours}h / visit</Text>
                  <Text style={styles.rowChevron}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <TouchableOpacity
          style={styles.assignBtn}
          onPress={() => navigation.navigate('AssignCycle', { customerId, customerName: customer.name })}
        >
          <Text style={styles.assignBtnText}>+ Add Service</Text>
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

      {/* Review Requests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Review Requests</Text>
        <View style={styles.optOutRow}>
          <View style={styles.optOutInfo}>
            <Text style={styles.optOutLabel}>Pause review requests</Text>
            <Text style={styles.optOutHint}>
              When on, this customer won&apos;t receive an SMS review link after a completed visit.
            </Text>
          </View>
          <Switch
            value={!!customer.reviewRequestsOptedOut}
            onValueChange={handleToggleOptOut}
            disabled={savingOptOut}
            trackColor={{ true: '#2563eb' }}
          />
        </View>
      </View>

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
                  {(() => {
                    // Lifecycle badge so the list shows "what's in flight" (§5.3).
                    const state = s.lifecycleState || (s.status === 'completed' ? 'completed' : 'proposed');
                    const badgeStyle = state === 'confirmed' ? styles.badgeConfirmed
                      : state === 'completed' ? styles.badgeCompleted
                      : styles.badgeProposed;
                    const label = state === 'confirmed' ? 'Confirmed'
                      : state === 'completed' ? 'Completed'
                      : 'Proposed';
                    return (
                      <View style={[styles.badge, badgeStyle]}>
                        <Text style={styles.badgeText}>{label}</Text>
                      </View>
                    );
                  })()}
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
    </>
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
  geocodeWarning: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 8, lineHeight: 16 },
  section: { backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowChevron: { fontSize: 18, color: '#c7d2fe', fontWeight: '400' },
  cycleInfo: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, color: '#333' },
  rowValue: { fontSize: 14, color: '#888' },
  emptyText: { fontSize: 14, color: '#aaa' },
  optOutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optOutInfo: { flex: 1, marginRight: 12 },
  optOutLabel: { fontSize: 15, color: '#333', fontWeight: '500' },
  optOutHint: { fontSize: 13, color: '#888', marginTop: 2, lineHeight: 18 },
  assignBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#2563eb', alignItems: 'center' },
  assignBtnText: { color: '#2563eb', fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeProposed: { backgroundColor: '#fef9c3' },
  badgeConfirmed: { backgroundColor: '#dbeafe' },
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

  // Profitability card
  profitGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  profitCell: { width: '50%', paddingVertical: 8 },
  profitCellLabel: {
    fontSize: 12, color: '#9ca3af', marginBottom: 3,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  profitCellValue: { fontSize: 19, fontWeight: '700', color: '#1a1a1a' },
  marginPositive: { color: '#059669' },
  marginNegative: { color: '#dc2626' },
  marginUnset: { color: '#9ca3af', fontStyle: 'italic' },
  profitFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  profitJobCount: { fontSize: 13, color: '#6b7280' },
  profitExpandLink: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  profitBreakdown: { marginTop: 4 },
  profitJobRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  profitJobLeft: { flex: 1 },
  profitJobDate: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  profitJobRef: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  profitJobRight: { alignItems: 'flex-end' },
  profitJobPriceCost: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  profitJobMargin: { fontSize: 15, fontWeight: '700' },

  // Recurring price editor modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 18 },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, marginBottom: 4,
  },
  amountPrefix: { fontSize: 20, fontWeight: '600', color: '#6b7280', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '600', color: '#1a1a1a', paddingVertical: 14 },
  modalSave: {
    marginTop: 16, paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#2563eb', alignItems: 'center',
  },
  modalSaveDisabled: { opacity: 0.6 },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  modalCancel: {
    marginTop: 16, paddingVertical: 13, borderRadius: 10,
    backgroundColor: '#f3f4f6', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  cyclePrice: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginTop: 2 },
  cyclePriceUnset: { color: '#9ca3af', fontStyle: 'italic', fontWeight: '500' },
});
