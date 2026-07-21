import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  ActivityIndicator, Alert, TouchableOpacity, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';
import { useAuth } from '../../context/AuthContext';
import { getJobDetail, completeJob, postGeofenceEvent } from '../../api/teamMemberApi';

const GEOFENCE_RADIUS_M = 100;

function formatDate(dateStr) {
  if (!dateStr) return '';
  const dateOnly = String(dateStr).split('T')[0];
  const d = new Date(dateOnly + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Haversine distance in metres between two lat/lng points
function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function JobDetailScreen({ route, navigation }) {
  const { user } = useAuth();
  const { selectionCycleId, customerName, serviceDate, serviceCycleName, customerAddress } = route.params;

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedTasks, setCheckedTasks] = useState(new Set());
  const [completionNotes, setCompletionNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Geo-fence state
  const [locationPermission, setLocationPermission] = useState(null); // null=unknown, true, false
  const [insideGeofence, setInsideGeofence] = useState(false);
  const [clockedIn, setClockedIn] = useState(false); // true after arrival posted
  const [clockLoading, setClockLoading] = useState(false);
  const watchIdRef = useRef(null);
  const insideRef = useRef(false); // ref to avoid stale closure in watchPosition callback
  const clockedInRef = useRef(false);
  const lastPosRef = useRef(null); // last known {latitude, longitude} from the watcher

  const fetchDetail = useCallback(async () => {
    try {
      const data = await getJobDetail(user.teamMemberId, selectionCycleId);
      setJob(data.job || null);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load job details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.teamMemberId, selectionCycleId]);

  useFocusEffect(
    useCallback(() => { fetchDetail(); }, [fetchDetail])
  );

  // Start / stop geo-fence polling based on job state
  useEffect(() => {
    if (!job || job.status === 'completed') return;
    const jobLat = job.customerLat;
    const jobLng = job.customerLng;

    if (jobLat == null || jobLng == null) {
      // No coordinates on file — fall back to manual clock-in. Leave
      // locationPermission null (we never requested it) so the UI shows only
      // "No address on file", not a misleading "Location access denied".
      return;
    }

    Geolocation.requestAuthorization(
      () => {
        setLocationPermission(true);
        startWatching(jobLat, jobLng);
      },
      () => {
        setLocationPermission(false);
      }
    );

    return () => stopWatchingAndCloseOut();
  }, [job?.status, job?.customerLat, job?.customerLng]);

  function startWatching(jobLat, jobLng) {
    stopWatching();
    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        lastPosRef.current = { latitude, longitude };
        const dist = distanceMetres(latitude, longitude, jobLat, jobLng);
        const nowInside = dist <= GEOFENCE_RADIUS_M;

        setInsideGeofence(nowInside);

        if (nowInside && !insideRef.current) {
          // Entered geofence — post arrival
          insideRef.current = true;
          clockedInRef.current = true;
          setClockedIn(true);
          postGeofenceEvent(user.teamMemberId, selectionCycleId, 'arrival', latitude, longitude, 'auto')
            .catch(e => console.warn('Arrival event failed:', e.message));
        } else if (!nowInside && insideRef.current) {
          // Exited geofence — post departure
          insideRef.current = false;
          setClockedIn(false);
          postGeofenceEvent(user.teamMemberId, selectionCycleId, 'departure', latitude, longitude, 'auto')
            .catch(e => console.warn('Departure event failed:', e.message));
        }
      },
      (err) => console.warn('Location watch error:', err.message),
      { enableHighAccuracy: true, distanceFilter: 10, interval: 15000, fastestInterval: 10000 }
    );
  }

  function stopWatching() {
    if (watchIdRef.current != null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  // Cleanup on unmount: if the team member is still on-site, post a synthetic
  // departure so the arrival isn't orphaned (which would leave no labor line).
  // Fire-and-forget with the last known position, or null coords if none.
  function stopWatchingAndCloseOut() {
    if (insideRef.current || clockedInRef.current) {
      const pos = lastPosRef.current;
      insideRef.current = false;
      clockedInRef.current = false;
      postGeofenceEvent(
        user.teamMemberId,
        selectionCycleId,
        'departure',
        pos ? pos.latitude : null,
        pos ? pos.longitude : null,
        'manual'
      ).catch(e => console.warn('Unmount departure failed:', e.message));
    }
    stopWatching();
  }

  // Post a manual clock event with the given coordinates, then update UI state.
  // Extracted so both the success and failure GPS callbacks route through one
  // place with a single try/catch/finally — a rejected network call always
  // clears the loading spinner instead of leaving the button stuck.
  const submitManualClock = async (eventType, latitude, longitude) => {
    try {
      await postGeofenceEvent(user.teamMemberId, selectionCycleId, eventType, latitude, longitude, 'manual');
      const nowClockedIn = eventType === 'arrival';
      setClockedIn(nowClockedIn);
      clockedInRef.current = nowClockedIn;
    } catch (err) {
      Alert.alert('Error', eventType === 'arrival' ? 'Could not record clock-in' : 'Could not record clock-out');
    } finally {
      setClockLoading(false);
    }
  };

  // Manual clock-in / clock-out (when no lat/lng or permission denied).
  const handleManualClock = (eventType) => {
    setClockLoading(true);
    Geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        submitManualClock(eventType, latitude, longitude);
      },
      () => {
        // No location available — record the event with null coords rather than
        // a fake 0,0 (which is a real point in the Gulf of Guinea and would be
        // indistinguishable from genuine GPS data). method='manual' flags the row.
        submitManualClock(eventType, null, null);
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const toggleTask = (idx) => {
    setCheckedTasks(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleComplete = () => {
    Alert.alert(
      'Mark Service Complete?',
      'This will record the service as done and capture the current time. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Complete',
          style: 'default',
          onPress: async () => {
            setCompleting(true);
            try {
              const data = await completeJob(user.teamMemberId, selectionCycleId, completionNotes.trim() || null);
              stopWatching();
              setJob(prev => ({
                ...prev,
                status: 'completed',
                completedAt: data.completion?.completedAt || new Date().toISOString(),
                completionNotes: completionNotes.trim() || null,
              }));
            } catch (err) {
              if (err.code === 'ALREADY_COMPLETED') {
                // First-to-complete-wins (TL3): a teammate on this job may have
                // closed it first. Treat as success — refresh into the completed
                // state rather than surfacing a raw error.
                Alert.alert('Already Complete', 'A teammate already marked this service complete.');
                fetchDetail();
              } else {
                Alert.alert('Error', err.message || 'Failed to mark service complete');
              }
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  const isCompleted = job?.status === 'completed';
  const hasTasks = job?.selectedTasks && job.selectedTasks.length > 0;
  const hasCoords = job?.customerLat != null && job?.customerLng != null;
  const hasAddress = !!(job?.customerAddress || customerAddress);
  // Normally manual clock is for jobs with no coords / denied permission. But if
  // a teammate completed this job first (TL3) while this member is still clocked
  // in, keep Clock Out available so their hours still record as labor.
  const showManualClock =
    (!isCompleted && (!hasCoords || locationPermission === false)) ||
    (isCompleted && clockedIn);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Blue summary card header */}
      <View style={styles.headerCard}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ My Jobs</Text>
        </TouchableOpacity>
        <Text style={styles.headerCustomer}>{job?.customerName ?? customerName}</Text>
        <Text style={styles.headerCycle}>{job?.serviceCycleName ?? serviceCycleName}</Text>
        <Text style={styles.headerDate}>{formatDate(job?.serviceDate ?? serviceDate)}</Text>
        <View style={[styles.statusBadge, isCompleted ? styles.badgeDone : styles.badgeOpen]}>
          <Text style={[styles.statusText, isCompleted ? styles.statusTextDone : styles.statusTextOpen]}>
            {isCompleted ? 'Completed' : 'Open'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDetail(); }} />
        }
      >
        {/* Address / directions */}
        {(job?.customerAddress || customerAddress) ? (
          <TouchableOpacity
            style={styles.directionsCard}
            activeOpacity={0.75}
            onPress={() => {
              const addr = job?.customerAddress || customerAddress;
              const encoded = encodeURIComponent(addr);
              Linking.openURL(`maps://?daddr=${encoded}`).catch(() =>
                Linking.openURL(`https://maps.google.com/?daddr=${encoded}`)
              );
            }}
          >
            <View style={styles.directionsInfo}>
              <Text style={styles.directionsLabel}>ADDRESS</Text>
              <Text style={styles.directionsAddress}>{job?.customerAddress || customerAddress}</Text>
            </View>
            <View style={styles.directionsBtn}>
              <Text style={styles.directionsBtnText}>Get Directions</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Auto geo-fence status indicator */}
        {!isCompleted && hasCoords && locationPermission === true && (
          <View style={[styles.geofenceCard, insideGeofence ? styles.geofenceInside : styles.geofenceOutside]}>
            <View style={[styles.geofenceDot, insideGeofence ? styles.geofenceDotInside : styles.geofenceDotOutside]} />
            <Text style={styles.geofenceText}>
              {insideGeofence ? 'At job site — time tracking active' : 'Outside job site radius'}
            </Text>
          </View>
        )}

        {/* Manual clock-in / clock-out buttons */}
        {showManualClock && (
          <View style={styles.clockCard}>
            <Text style={styles.clockLabel}>CLOCK IN / OUT</Text>
            {isCompleted ? (
              <Text style={styles.clockSubtext}>A teammate completed this job — clock out to log your hours</Text>
            ) : !hasCoords ? (
              <Text style={styles.clockSubtext}>
                {hasAddress
                  ? 'Address not mapped yet — using manual tracking'
                  : 'No address on file — using manual tracking'}
              </Text>
            ) : locationPermission === false ? (
              <Text style={styles.clockSubtext}>Location access denied — using manual tracking</Text>
            ) : null}
            {clockLoading ? (
              <ActivityIndicator color="#2563eb" style={{ marginTop: 12 }} />
            ) : clockedIn ? (
              <TouchableOpacity style={styles.clockOutBtn} onPress={() => handleManualClock('departure')}>
                <Text style={styles.clockBtnText}>Clock Out</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.clockInBtn} onPress={() => handleManualClock('arrival')}>
                <Text style={styles.clockBtnText}>Clock In</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Per-visit note from the SMS 'N' keyword flow */}
        {job?.customerNote ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesSectionLabel}>NOTE FOR THIS VISIT</Text>
            <Text style={styles.notesCardText}>{job.customerNote}</Text>
          </View>
        ) : null}

        {/* Persistent customer notes */}
        {job?.customerNotes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesSectionLabel}>CUSTOMER NOTES</Text>
            <Text style={styles.notesCardText}>{job.customerNotes}</Text>
          </View>
        ) : null}

        {/* Task list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tasks</Text>

          {hasTasks ? (
            job.selectedTasks.map((task, idx) => {
              const checked = isCompleted || checkedTasks.has(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.taskRow}
                  onPress={() => !isCompleted && toggleTask(idx)}
                  activeOpacity={isCompleted ? 1 : 0.6}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskName, checked && styles.taskNameDone]}>
                      {task.name || task.taskName || `Task ${idx + 1}`}
                    </Text>
                    {task.description ? (
                      <Text style={styles.taskDesc}>{task.description}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyTasks}>
              <Text style={styles.emptyTasksTitle}>No tasks listed</Text>
              <Text style={styles.emptyTasksSub}>
                {isCompleted
                  ? 'This service was completed without a task list.'
                  : 'No task selection has been submitted for this service date.'}
              </Text>
            </View>
          )}
        </View>

        {/* Selection status */}
        {job?.selectionStatus && !isCompleted && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Selection</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[
                styles.selBadge,
                job.selectionStatus === 'submitted' ? styles.selBadgeSubmitted : styles.selBadgeDraft,
              ]}>
                <Text style={styles.selBadgeText}>
                  {job.selectionStatus === 'submitted' ? 'Tasks submitted' : 'Draft saved'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Completion record (post-complete) */}
        {isCompleted && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerIcon}>✓</Text>
            <View style={styles.completedBannerInfo}>
              <Text style={styles.completedBannerTitle}>Service Complete</Text>
              {job.completedAt ? (
                <Text style={styles.completedBannerTime}>{formatDateTime(job.completedAt)}</Text>
              ) : null}
              {job.completionNotes ? (
                <Text style={styles.completedBannerNotes}>"{job.completionNotes}"</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Deadline */}
        {job?.submissionDeadline && !isCompleted && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deadline</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Task selection due</Text>
              <Text style={styles.infoValue}>{formatDate(String(job.submissionDeadline).split('T')[0])}</Text>
            </View>
          </View>
        )}

        {/* Completion notes input + Mark Complete (open jobs only) */}
        {!isCompleted && (
          <View style={styles.completeSection}>
            <Text style={styles.completeSectionLabel}>COMPLETION NOTES (OPTIONAL)</Text>
            <TextInput
              style={styles.completionNotesInput}
              placeholder="Gate code, access notes, anything to flag..."
              placeholderTextColor="#aaa"
              value={completionNotes}
              onChangeText={setCompletionNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.completeBtn, completing && styles.completeBtnDisabled]}
              onPress={handleComplete}
              disabled={completing}
            >
              {completing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.completeBtnText}>Mark Service Complete</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerCard: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 24,
  },
  backBtn: { marginBottom: 14 },
  backText: { color: '#bfdbfe', fontSize: 15, fontWeight: '500' },
  headerCustomer: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerCycle: { fontSize: 14, color: '#bfdbfe', marginBottom: 6 },
  headerDate: { fontSize: 15, color: '#dbeafe', fontWeight: '500', marginBottom: 12 },

  statusBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeOpen: { backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeDone: { backgroundColor: 'rgba(16,185,129,0.25)' },
  statusText: { fontSize: 13, fontWeight: '700' },
  statusTextOpen: { color: '#fff' },
  statusTextDone: { color: '#6ee7b7' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },

  // Address card
  directionsCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  directionsInfo: { flex: 1, marginRight: 12 },
  directionsLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1, marginBottom: 4 },
  directionsAddress: { fontSize: 14, color: '#1a1a1a', fontWeight: '500', lineHeight: 20 },
  directionsBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  directionsBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Geo-fence status card
  geofenceCard: {
    borderRadius: 12, padding: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  geofenceInside: { backgroundColor: '#ecfdf5' },
  geofenceOutside: { backgroundColor: '#f3f4f6' },
  geofenceDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  geofenceDotInside: { backgroundColor: '#10b981' },
  geofenceDotOutside: { backgroundColor: '#9ca3af' },
  geofenceText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  // Manual clock card
  clockCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  clockLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1, marginBottom: 4 },
  clockSubtext: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
  clockInBtn: {
    backgroundColor: '#2563eb', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  clockOutBtn: {
    backgroundColor: '#dc2626', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  clockBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Customer notes card
  notesCard: {
    backgroundColor: '#fffbeb', borderRadius: 12, padding: 16, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: '#f59e0b',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  notesSectionLabel: { fontSize: 11, fontWeight: '700', color: '#b45309', letterSpacing: 1, marginBottom: 8 },
  notesCardText: { fontSize: 14, color: '#1a1a1a', lineHeight: 22 },

  // Generic white section card
  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14,
  },

  // Task rows with checkboxes
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db',
    backgroundColor: '#fff', marginRight: 12, marginTop: 1, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#10b981', borderColor: '#10b981' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 16 },
  taskInfo: { flex: 1, paddingTop: 2 },
  taskName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  taskNameDone: { color: '#9ca3af', textDecorationLine: 'line-through' },
  taskDesc: { fontSize: 13, color: '#888', marginTop: 2, lineHeight: 18 },

  emptyTasks: { paddingVertical: 8, alignItems: 'center' },
  emptyTasksTitle: { fontSize: 15, fontWeight: '600', color: '#555', marginBottom: 6 },
  emptyTasksSub: { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  infoLabel: { fontSize: 14, color: '#555' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', flex: 1, textAlign: 'right' },

  selBadge: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 3 },
  selBadgeSubmitted: { backgroundColor: '#d1fae5' },
  selBadgeDraft: { backgroundColor: '#fef9c3' },
  selBadgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  // Completion banner (post-complete)
  completedBanner: {
    backgroundColor: '#ecfdf5', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'flex-start',
    borderLeftWidth: 4, borderLeftColor: '#10b981',
  },
  completedBannerIcon: { fontSize: 20, color: '#10b981', marginRight: 12, marginTop: 1 },
  completedBannerInfo: { flex: 1 },
  completedBannerTitle: { fontSize: 15, fontWeight: '700', color: '#065f46', marginBottom: 2 },
  completedBannerTime: { fontSize: 13, color: '#047857' },
  completedBannerNotes: { fontSize: 13, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },

  // Complete section at bottom
  completeSection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  completeSectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1, marginBottom: 10,
  },
  completionNotesInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    backgroundColor: '#fafafa', color: '#1a1a1a', marginBottom: 14,
    minHeight: 76,
  },
  completeBtn: {
    backgroundColor: '#10b981', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  completeBtnDisabled: { backgroundColor: '#6ee7b7' },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
