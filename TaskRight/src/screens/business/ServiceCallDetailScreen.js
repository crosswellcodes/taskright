import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getServiceCallDetail, rescheduleSelectionCycle } from '../../api/businessApi';
import { formatPhone } from '../../utils/phoneUtils';
import { Calendar } from 'react-native-calendars';

function safeDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const s = String(dateStr).split('T')[0];
  return new Date(s + 'T12:00:00');
}

function formatFullDate(dateStr) {
  if (!dateStr) return '—';
  return safeDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  return safeDate(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function ServiceCallDetailScreen({ route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    selectionCycleId,
    serviceDate: paramServiceDate,
    status: paramStatus,
    serviceCycleName: paramCycleName,
    submissionDeadline: paramDeadline,
    customerName,
  } = route.params;

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // Local state for optimistic reschedule
  const [currentServiceDate, setCurrentServiceDate] = useState(paramServiceDate);
  const [showCalendar, setShowCalendar] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const data = await getServiceCallDetail(user.businessId, selectionCycleId);
      setDetail(data.serviceCall || null);
      if (data.serviceCall?.serviceDate) {
        setCurrentServiceDate(data.serviceCall.serviceDate);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load service call');
    } finally {
      setLoading(false);
    }
  }, [user.businessId, selectionCycleId]);

  useFocusEffect(useCallback(() => { fetchDetail(); }, [fetchDetail]));

  async function handleReschedule(newDate) {
    const previousDate = currentServiceDate;
    setCurrentServiceDate(newDate);
    setSaving(true);
    try {
      await rescheduleSelectionCycle(user.businessId, selectionCycleId, newDate);
      setDetail(prev => prev ? { ...prev, serviceDate: newDate } : prev);
    } catch (err) {
      setCurrentServiceDate(previousDate);
      Alert.alert('Error', err.message || 'Failed to update service date');
    } finally {
      setSaving(false);
    }
  }

  // Fall back to params while loading so header renders immediately
  const displayDate = currentServiceDate || paramServiceDate;
  const displayStatus = detail?.status || paramStatus;
  const displayCycleName = detail?.serviceCycleName || paramCycleName;
  const displayDeadline = detail?.submissionDeadline || paramDeadline;
  const isOpen = displayStatus === 'open';
  const hasTasks = detail?.selectedTasks && detail.selectedTasks.length > 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Blue header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.headerInfo}>
              <Text style={styles.headerCustomer}>{customerName}</Text>
              <Text style={styles.headerDate}>{formatFullDate(displayDate)}</Text>
            </View>
            {isOpen && (
              <TouchableOpacity
                style={styles.changeDateBtn}
                onPress={() => setShowCalendar(true)}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.changeDateBtnText}>Change Date</Text>
                }
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.statusPill, isOpen ? styles.pillOpen : styles.pillCompleted]}>
            <Text style={[styles.statusPillText, isOpen ? styles.pillOpenText : styles.pillCompletedText]}>
              {isOpen ? 'Open' : 'Completed'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        ) : (
          <>
            {/* Service Cycle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service Cycle</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Cycle</Text>
                <Text style={styles.detailValue}>{displayCycleName || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Submission Deadline</Text>
                <Text style={styles.detailValue}>{formatShortDate(displayDeadline)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reference ID</Text>
                <Text style={styles.detailValue}>#{selectionCycleId}</Text>
              </View>
            </View>

            {/* Assignment — individual or team */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {detail?.team ? 'Team' : 'Team Member'}
              </Text>
              {detail?.teamMember ? (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name</Text>
                    <Text style={styles.detailValue}>{detail.teamMember.name}</Text>
                  </View>
                  {detail.teamMember.phone ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Phone</Text>
                      <Text style={styles.detailValue}>{formatPhone(detail.teamMember.phone)}</Text>
                    </View>
                  ) : null}
                </>
              ) : detail?.team ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Team</Text>
                  <Text style={styles.detailValue}>{detail.team.name}</Text>
                </View>
              ) : (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No assignment yet</Text>
                </View>
              )}
            </View>

            {/* Tasks */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tasks</Text>
              {hasTasks ? (
                detail.selectedTasks.map((task, idx) => (
                  <View key={idx} style={styles.taskRow}>
                    <View style={styles.taskBullet} />
                    <View style={styles.taskInfo}>
                      <Text style={styles.taskName}>
                        {task.name || task.taskName || `Task ${idx + 1}`}
                      </Text>
                      {task.description ? (
                        <Text style={styles.taskDesc}>{task.description}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>
                    {detail?.selectionStatus === 'submitted'
                      ? 'Tasks submitted but none listed'
                      : 'Customer has not submitted their task selection yet'}
                  </Text>
                </View>
              )}
              {detail?.selectionStatus && (
                <View style={[
                  styles.selBadgeRow,
                  detail.selectionStatus === 'submitted' ? styles.selBadgeSubmitted : styles.selBadgeDraft,
                ]}>
                  <Text style={styles.selBadgeText}>
                    {detail.selectionStatus === 'submitted' ? 'Selection submitted' : 'Draft saved'}
                  </Text>
                </View>
              )}
            </View>

            {/* Completion */}
            {!isOpen && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Completion</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Completed at</Text>
                  <Text style={styles.detailValue}>{formatDateTime(detail?.completedAt)}</Text>
                </View>
                {detail?.completionNotes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Notes</Text>
                    <Text style={styles.notesText}>{detail.completionNotes}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Reschedule Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select New Date</Text>
            <Text style={styles.modalSubtitle}>
              Only this service call will be moved. Future scheduled dates are not affected.
            </Text>
            <Calendar
              minDate={getTomorrow()}
              markedDates={{
                [String(currentServiceDate).split('T')[0]]: { selected: true, selectedColor: '#2563eb' },
              }}
              onDayPress={(day) => {
                setShowCalendar(false);
                handleReschedule(day.dateString);
              }}
              renderArrow={(direction) => (
                <View style={styles.calArrow}>
                  <Text style={styles.calArrowText}>{direction === 'left' ? '‹' : '›'}</Text>
                </View>
              )}
              theme={{
                todayTextColor: '#2563eb',
                selectedDayBackgroundColor: '#2563eb',
                arrowColor: '#2563eb',
              }}
            />
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCalendar(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },

  headerCard: {
    backgroundColor: '#2563eb',
    padding: 24, paddingTop: 28,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 14,
  },
  headerInfo: { flex: 1, marginRight: 12 },
  headerCustomer: {
    fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  headerDate: { fontSize: 20, fontWeight: '700', color: '#fff' },
  changeDateBtn: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: 'flex-start', minWidth: 44, alignItems: 'center',
  },
  changeDateBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  pillOpen: { backgroundColor: 'rgba(255,255,255,0.2)' },
  pillCompleted: { backgroundColor: 'rgba(16,185,129,0.25)' },
  statusPillText: { fontSize: 13, fontWeight: '600' },
  pillOpenText: { color: '#fff' },
  pillCompletedText: { color: '#6ee7b7' },

  loadingRow: { paddingTop: 48, alignItems: 'center' },

  section: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  detailLabel: { fontSize: 14, color: '#6b7280' },
  detailValue: {
    fontSize: 14, color: '#1a1a1a', fontWeight: '500',
    textAlign: 'right', flex: 1, marginLeft: 16,
  },

  emptyRow: {
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  emptyText: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },

  taskRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  taskBullet: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#2563eb',
    marginTop: 5, marginRight: 10, flexShrink: 0,
  },
  taskInfo: { flex: 1 },
  taskName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  taskDesc: { fontSize: 13, color: '#888', marginTop: 2 },

  selBadgeRow: {
    marginTop: 12, alignSelf: 'flex-start',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4,
  },
  selBadgeSubmitted: { backgroundColor: '#d1fae5' },
  selBadgeDraft: { backgroundColor: '#fef9c3' },
  selBadgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  notesBox: { marginTop: 8, backgroundColor: '#f8fafc', borderRadius: 8, padding: 12 },
  notesLabel: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 4 },
  notesText: { fontSize: 14, color: '#444', lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 18 },
  calArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
    alignItems: 'center', justifyContent: 'center',
  },
  calArrowText: { color: '#2563eb', fontSize: 22, fontWeight: '600', lineHeight: 28 },
  modalCancel: {
    marginTop: 16, paddingVertical: 13, borderRadius: 10,
    backgroundColor: '#f3f4f6', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
