import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, RefreshControl, Modal
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getCurrentSelectionCycle, getUpcomingServices } from '../../api/customerApi';

// "John Doe" → "John D."  |  "John" → "John"
function firstNameLastInitial(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function formatUpcomingDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function CurrentSelectionScreen({ navigation }) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [cycle, setCycle] = useState(null);
  const [recentCompletion, setRecentCompletion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasksModalVisible, setTasksModalVisible] = useState(false);

  // ── Upcoming services state ─────────────────────────────────────────────────
  const [upcomingModalVisible, setUpcomingModalVisible] = useState(false);
  const [upcomingServices, setUpcomingServices] = useState([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  const fetchCycle = useCallback(async () => {
    try {
      const [cycleData, upcomingData] = await Promise.all([
        getCurrentSelectionCycle(user.customerId),
        getUpcomingServices(user.customerId).catch(() => ({ services: [] })),
      ]);
      setCycle(cycleData.selectionCycle || null);
      setRecentCompletion(cycleData.recentCompletion || null);
      setUpcomingServices(upcomingData.services || []);
    } catch (err) {
      if (err.status === 404) {
        setCycle(null);
        setRecentCompletion(null);
      } else {
        Alert.alert('Error', err.message || 'Failed to load your service');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.customerId]);

  // Modal just opens — data already loaded on mount
  const openUpcomingModal = useCallback(() => {
    setUpcomingModalVisible(true);
  }, []);

  // Build marked dates from upcoming services for the inline calendar
  const markedDates = useMemo(() => {
    const marks = {};
    upcomingServices.forEach(svc => {
      const key = svc.serviceDate?.split('T')[0];
      if (key) {
        marks[key] = {
          marked: true,
          dotColor: svc.selectionSubmitted ? '#10b981' : '#2563eb',
          selected: key === selectedCalendarDate,
          selectedColor: '#2563eb',
        };
      }
    });
    return marks;
  }, [upcomingServices, selectedCalendarDate]);

  // Close the upcoming modal and navigate to TaskPicker for the chosen service
  const handleSelectTasksForUpcoming = useCallback((svc) => {
    setUpcomingModalVisible(false);
    const cycleForPicker = {
      id: svc.id,
      serviceDate: svc.serviceDate,
      businessName: svc.businessName,
      totalHours: svc.totalHours,
      totalMinutesAvailable: svc.totalMinutesAvailable,
      availableTasks: svc.availableTasks,
      status: 'open',
      previousSelection: null,
    };
    // Brief delay so the modal finishes closing before the screen pushes
    setTimeout(() => navigation.navigate('TaskPicker', { cycle: cycleForPicker }), 300);
  }, [navigation]);

  useEffect(() => {
    fetchCycle();
  }, [fetchCycle]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchCycle);
    return unsubscribe;
  }, [navigation, fetchCycle]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  // Nothing at all — no upcoming service and no recent completion
  if (!cycle && !recentCompletion) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No upcoming service</Text>
        <Text style={styles.emptySubtitle}>Your service provider hasn't scheduled a service yet.</Text>
        <TouchableOpacity style={styles.linkBtn} onPress={logout}>
          <Text style={styles.linkText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Format the upcoming service date (if any)
  const serviceDate = cycle
    ? new Date(cycle.serviceDate).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : null;

  const hasSubmitted = !!(cycle && cycle.previousSelection);
  const cycleIsOpen = !!(cycle && cycle.status === 'open');

  // Submitted tasks in the customer's chosen priority order (map over the stored
  // id array, don't filter the menu — filtering would lose the ranking).
  const submittedTasks = hasSubmitted
    ? (cycle.previousSelection.selectedTasks || [])
        .map(id => (cycle.availableTasks || []).find(t => t.id === id))
        .filter(Boolean)
    : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCycle(); }} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi, {user.name}</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── Blue "Next Service" card — only shown when there's an upcoming open cycle ── */}
      {cycle ? (
        <TouchableOpacity style={styles.card} onPress={() => setTasksModalVisible(true)} activeOpacity={0.85}>
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Next Service</Text>
            {hasSubmitted ? (
              <View style={styles.cardStatusBadge}>
                <Text style={styles.cardStatusBadgeText}>✓ Submitted</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardLeft}>
              <Text style={styles.dateText}>{serviceDate}</Text>
              {cycle.businessName ? (
                <Text style={styles.businessName}>{cycle.businessName}</Text>
              ) : null}
              <Text style={styles.cardRef}>Ref #{cycle.id}</Text>
              <Text style={styles.cardHint}>
                {hasSubmitted ? 'Tap to review your selections →' : 'Tap to view and select tasks →'}
              </Text>
            </View>
            {cycle.assignedStaff && cycle.assignedStaff.length > 0 ? (
              <View style={styles.cardRight}>
                {cycle.assignedStaff.map((s, i) => (
                  <View key={s.id || i} style={styles.staffPill}>
                    <Text style={styles.staffPillText}>{firstNameLastInitial(s.name)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      ) : null}

      {/* ── Tasks modal for the upcoming cycle ── */}
      {cycle ? (
        <Modal visible={tasksModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTasksModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {hasSubmitted ? 'Your Selections' : 'Service Tasks'}
              </Text>
              <TouchableOpacity onPress={() => setTasksModalVisible(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            {cycle.businessName ? (
              <Text style={styles.modalBusiness}>{cycle.businessName}</Text>
            ) : null}
            <Text style={styles.modalDate}>{serviceDate}</Text>
            <Text style={styles.modalRef}>Ref #{cycle.id}</Text>

            {/* ── Who's Coming section ── */}
            {cycle.assignedStaff && cycle.assignedStaff.length > 0 ? (
              <View style={styles.modalStaffSection}>
                <Text style={styles.modalStaffHeading}>WHO'S COMING</Text>
                <View style={styles.modalStaffPillsRow}>
                  {cycle.assignedStaff.map((s, i) => (
                    <View key={s.id || i} style={styles.modalStaffPill}>
                      <Text style={styles.modalStaffPillText}>{firstNameLastInitial(s.name)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {hasSubmitted ? (
                submittedTasks.length === 0 ? (
                  <Text style={styles.modalEmpty}>No tasks selected.</Text>
                ) : (
                  submittedTasks.map((task, index) => (
                    <View key={task.id} style={[styles.modalTaskRow, styles.modalTaskRowSelected]}>
                      <View style={styles.modalRankBadge}>
                        <Text style={styles.modalRankBadgeText}>{index + 1}</Text>
                      </View>
                      <Text style={[styles.modalTaskName, styles.modalTaskNameSelected]}>{task.name}</Text>
                    </View>
                  ))
                )
              ) : (
                (cycle.availableTasks || []).length === 0 ? (
                  <Text style={styles.modalEmpty}>No tasks have been added to this service yet.</Text>
                ) : (
                  (cycle.availableTasks || []).map(task => (
                    <View key={task.id} style={styles.modalTaskRow}>
                      <Text style={styles.modalTaskName}>{task.name}</Text>
                    </View>
                  ))
                )
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              {hasSubmitted ? (
                <Text style={styles.modalFooterText}>
                  {submittedTasks.length} task{submittedTasks.length !== 1 ? 's' : ''}, in your priority order
                </Text>
              ) : (cycle.availableTasks || []).length > 0 ? (
                <>
                  <Text style={styles.modalFooterText}>
                    {cycle.availableTasks.length} task{cycle.availableTasks.length !== 1 ? 's' : ''}
                  </Text>
                  <TouchableOpacity
                    style={styles.modalSelectBtn}
                    onPress={() => {
                      setTasksModalVisible(false);
                      setTimeout(() => navigation.navigate('TaskPicker', { cycle }), 300);
                    }}
                  >
                    <Text style={styles.modalSelectBtnText}>Select Tasks</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.modalFooterText}>No tasks have been added yet</Text>
              )}
            </View>
          </View>
        </Modal>
      ) : null}

      {/* ── Upcoming Services modal ─────────────────────────────────────────── */}
      <Modal
        visible={upcomingModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUpcomingModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upcoming Services</Text>
            <TouchableOpacity onPress={() => setUpcomingModalVisible(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>

          {upcomingServices.length === 0 ? (
            <View style={styles.upcomingEmpty}>
              <Text style={styles.upcomingEmptyText}>No upcoming services scheduled.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.upcomingScroll}>
              {upcomingServices.map((svc, i) => (
                <TouchableOpacity
                  key={svc.id}
                  style={[styles.upcomingRow, i === 0 && styles.upcomingRowFirst]}
                  onPress={!svc.selectionSubmitted ? () => handleSelectTasksForUpcoming(svc) : undefined}
                  activeOpacity={svc.selectionSubmitted ? 1 : 0.7}
                >
                  {/* Left accent bar — blue for next, grey for later */}
                  <View style={[styles.upcomingAccent, i === 0 && styles.upcomingAccentFirst]} />
                  <View style={styles.upcomingContent}>
                    <View style={styles.upcomingTopRow}>
                      <Text style={[styles.upcomingDate, i === 0 && styles.upcomingDateFirst]}>
                        {formatUpcomingDate(svc.serviceDate)}
                      </Text>
                      {i === 0 ? (
                        <View style={styles.nextBadge}>
                          <Text style={styles.nextBadgeText}>Next</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.upcomingBottomRow}>
                      <Text style={styles.upcomingHours}>
                        {(svc.availableTasks?.length || 0)} task{(svc.availableTasks?.length || 0) !== 1 ? 's' : ''}
                      </Text>
                      {svc.selectionSubmitted ? (
                        <View style={styles.submittedBadge}>
                          <Text style={styles.submittedBadgeText}>✓ Tasks Selected</Text>
                        </View>
                      ) : (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Select Tasks →</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.upcomingRef}>Ref #{svc.id}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── "Service complete" banner — shown when there's a recent completion without feedback ── */}
      {recentCompletion ? (
        <View style={styles.completedBanner}>
          <Text style={styles.completedText}>Service complete</Text>
          <Text style={styles.completedSub}>
            {new Date(recentCompletion.serviceDate).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </Text>
          <TouchableOpacity
            style={styles.feedbackBtn}
            onPress={() => navigation.navigate('Feedback', {
              customerId: user.customerId,
              selectionCycleId: recentCompletion.id,
              serviceDate: recentCompletion.serviceDate,
            })}
          >
            <Text style={styles.feedbackBtnText}>Leave Feedback</Text>
          </TouchableOpacity>
        </View>
      ) : null}


      {/* ── Bottom nav links ── */}
      <TouchableOpacity
        style={styles.upcomingBtn}
        onPress={openUpcomingModal}
      >
        <Text style={styles.upcomingBtnText}>List View of Upcoming Services</Text>
      </TouchableOpacity>

      {/* ── Inline upcoming-services calendar ── */}
      {upcomingServices.length > 0 && (
        <View style={styles.calendarCard}>
          <Calendar
            markedDates={markedDates}
            onDayPress={(day) => {
              const match = upcomingServices.find(
                s => s.serviceDate?.split('T')[0] === day.dateString
              );
              setSelectedCalendarDate(match ? day.dateString : null);
            }}
            renderArrow={(direction) => (
              <View style={styles.calArrow}>
                <Text style={styles.calArrowText}>{direction === 'left' ? '‹' : '›'}</Text>
              </View>
            )}
            theme={{
              todayTextColor: '#2563eb',
              selectedDayBackgroundColor: '#2563eb',
              dotColor: '#2563eb',
              selectedDotColor: '#fff',
            }}
          />

          {/* Selected date detail card */}
          {selectedCalendarDate && (() => {
            const svc = upcomingServices.find(
              s => s.serviceDate?.split('T')[0] === selectedCalendarDate
            );
            if (!svc) return null;
            return (
              <View style={styles.calDetailCard}>
                <View style={styles.calDetailTop}>
                  <Text style={styles.calDetailDate}>{formatUpcomingDate(svc.serviceDate)}</Text>
                  <View style={[styles.calDetailBadge, svc.selectionSubmitted && styles.calDetailBadgeSubmitted]}>
                    <Text style={styles.calDetailBadgeText}>
                      {svc.selectionSubmitted ? '✓ Tasks Selected' : 'Pending'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.calDetailHours}>
                  {(svc.availableTasks?.length || 0)} task{(svc.availableTasks?.length || 0) !== 1 ? 's' : ''} · Ref #{svc.id}
                </Text>
                {!svc.selectionSubmitted && (
                  <TouchableOpacity
                    style={styles.calDetailBtn}
                    onPress={() => handleSelectTasksForUpcoming(svc)}
                  >
                    <Text style={styles.calDetailBtnText}>Choose Tasks →</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
        </View>
      )}

      <TouchableOpacity
        style={styles.historyBtn}
        onPress={() => navigation.navigate('History')}
      >
        <Text style={styles.historyBtnText}>View History</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8
  },
  greeting: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  signOut: { color: '#2563eb', fontSize: 15 },
  card: {
    backgroundColor: '#2563eb', margin: 16, borderRadius: 14,
    padding: 20,
  },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  cardStatusBadge: {
    backgroundColor: 'rgba(134, 239, 172, 0.25)', borderRadius: 10,
    paddingVertical: 2, paddingHorizontal: 8,
    borderWidth: 1, borderColor: 'rgba(134, 239, 172, 0.4)',
  },
  cardStatusBadgeText: { color: '#86efac', fontSize: 11, fontWeight: '700' },
  dateText: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  businessName: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  cardRef: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 },
  cardHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 10 },
  modalRef: { fontSize: 11, color: '#9ca3af', paddingHorizontal: 20, marginBottom: 12, marginTop: -10 },
  modalBusiness: { fontSize: 15, fontWeight: '600', color: '#2563eb', paddingHorizontal: 20, marginBottom: 2 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  modalClose: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  modalDate: { fontSize: 13, color: '#888', paddingHorizontal: 20, marginBottom: 16 },
  modalScroll: { paddingHorizontal: 20, paddingBottom: 24 },
  modalEmpty: { fontSize: 15, color: '#888', textAlign: 'center', marginTop: 40 },
  modalTaskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTaskRowSelected: { backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 8, marginBottom: 2, borderBottomWidth: 0 },
  modalRankBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  modalRankBadgeText: { color: '#15803d', fontSize: 12, fontWeight: '700' },
  modalTaskName: { fontSize: 15, color: '#1a1a1a', flex: 1, marginRight: 12 },
  modalTaskNameSelected: { color: '#15803d', fontWeight: '600' },
  modalFooter: {
    borderTopWidth: 1, borderTopColor: '#eee',
    paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center',
  },
  modalFooterText: { fontSize: 13, color: '#888', marginBottom: 0 },
  modalSelectBtn: {
    marginTop: 12, backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', width: '100%',
  },
  modalSelectBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  taskSummary: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 10 },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  taskName: { fontSize: 15, color: '#333' },
  taskTime: { fontSize: 14, color: '#888' },
  moreText: { color: '#2563eb', fontSize: 14, marginTop: 6 },
  primaryBtn: {
    backgroundColor: '#2563eb', marginHorizontal: 16, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  completedBanner: {
    backgroundColor: '#f3f4f6', marginHorizontal: 16, borderRadius: 12,
    padding: 16, marginBottom: 16,
  },
  completedText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  completedSub: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 2 },
  feedbackBtn: {
    marginTop: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#374151',
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  feedbackBtnText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  upcomingBtn: {
    marginHorizontal: 16, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginBottom: 4,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#2563eb',
  },
  upcomingBtnText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  historyBtn: { marginHorizontal: 16, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 32 },
  historyBtnText: { color: '#2563eb', fontSize: 15 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 24 },
  linkBtn: { marginTop: 8 },
  linkText: { color: '#2563eb', fontSize: 15 },

  // ── Staff / "Who's Coming" styles ──────────────────────────────────────────
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  cardLeft: { flex: 1, marginRight: 10 },
  cardRight: { alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2 },
  staffPill: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 10, marginBottom: 5,
  },
  staffPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  modalStaffSection: {
    marginHorizontal: 20, marginBottom: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#f0f4ff', borderRadius: 10,
  },
  modalStaffHeading: {
    fontSize: 11, fontWeight: '700', color: '#2563eb',
    letterSpacing: 0.8, marginBottom: 8,
  },
  modalStaffPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalStaffPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  modalStaffPillText: { color: '#1d4ed8', fontSize: 13, fontWeight: '600' },

  // ── Inline calendar styles ──────────────────────────────────────────────────
  calendarCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 4,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  calArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
    alignItems: 'center', justifyContent: 'center',
  },
  calArrowText: { color: '#2563eb', fontSize: 22, fontWeight: '600', lineHeight: 28 },
  calDetailCard: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0', padding: 16,
  },
  calDetailTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  calDetailDate: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', flex: 1, marginRight: 8 },
  calDetailBadge: {
    backgroundColor: '#dbeafe', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
  },
  calDetailBadgeSubmitted: { backgroundColor: '#d1fae5' },
  calDetailBadgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  calDetailHours: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  calDetailBtn: {
    backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  calDetailBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // ── Upcoming Services modal styles ─────────────────────────────────────────
  upcomingEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  upcomingEmptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
  upcomingScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  upcomingRow: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    marginBottom: 10, overflow: 'hidden',
  },
  upcomingRowFirst: { borderColor: '#2563eb', borderWidth: 1.5 },
  upcomingAccent: { width: 4, backgroundColor: '#d1d5db' },
  upcomingAccentFirst: { backgroundColor: '#2563eb' },
  upcomingContent: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  upcomingTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  upcomingDate: { fontSize: 15, color: '#374151', fontWeight: '500', flex: 1 },
  upcomingDateFirst: { color: '#1a1a1a', fontWeight: '700' },
  nextBadge: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 2, paddingHorizontal: 8,
  },
  nextBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  upcomingBottomRow: { flexDirection: 'row', alignItems: 'center' },
  upcomingHours: { fontSize: 13, color: '#6b7280', flex: 1 },
  submittedBadge: {
    backgroundColor: '#d1fae5', borderRadius: 10,
    paddingVertical: 3, paddingHorizontal: 8,
  },
  submittedBadgeText: { color: '#065f46', fontSize: 12, fontWeight: '600' },
  pendingBadge: {
    backgroundColor: '#fef3c7', borderRadius: 10,
    paddingVertical: 3, paddingHorizontal: 8,
  },
  pendingBadgeText: { color: '#92400e', fontSize: 12, fontWeight: '600' },
  upcomingRef: { fontSize: 11, color: '#c4c9d4', marginTop: 3 },
});
