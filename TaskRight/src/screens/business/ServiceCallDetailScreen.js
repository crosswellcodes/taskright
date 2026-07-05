import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  getServiceCallDetail, rescheduleSelectionCycle, getJobCosts, setJobPrice,
  getCostCategories, addJobCost, updateJobCost, deleteJobCost,
} from '../../api/businessApi';
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

function money(n) {
  if (n === null || n === undefined || n === '') return '—';
  return `$${Number(n).toFixed(2)}`;
}

function formatHours(n) {
  if (n === null || n === undefined || n === '') return '—';
  return `${Number(n).toFixed(2)}h`;
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
  const [costs, setCosts] = useState(null);

  // Job-costing editors
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [savingCost, setSavingCost] = useState(false);
  const [categories, setCategories] = useState([]);
  // Amount editor for materials/overhead: { type, label, costId, categoryId } | null
  const [editingField, setEditingField] = useState(null);
  const [fieldInput, setFieldInput] = useState('');

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

  const fetchCosts = useCallback(async () => {
    try {
      const data = await getJobCosts(user.businessId, selectionCycleId);
      setCosts(data.costs || null);
    } catch (err) {
      // Non-blocking: costing is supplementary to the core service-call view
      setCosts(null);
    }
  }, [user.businessId, selectionCycleId]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getCostCategories(user.businessId);
      setCategories(data.categories || []);
    } catch (err) {
      setCategories([]);
    }
  }, [user.businessId]);

  useFocusEffect(useCallback(() => {
    fetchDetail();
    fetchCosts();
    fetchCategories();
  }, [fetchDetail, fetchCosts, fetchCategories]));

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

  function openPriceEditor() {
    setPriceInput(priceSet ? String(costs.price) : '');
    setEditingPrice(true);
  }

  async function handleSavePrice() {
    const trimmed = priceInput.trim();
    let value;
    if (trimmed === '') {
      value = null; // clears the price → "Price not set"
    } else {
      value = Number(trimmed);
      if (Number.isNaN(value) || value < 0) {
        Alert.alert('Invalid price', 'Enter a non-negative dollar amount, or leave it blank to clear the price.');
        return;
      }
    }
    setSavingCost(true);
    try {
      await setJobPrice(user.businessId, selectionCycleId, value);
      await fetchCosts(); // refetch so margin / total recompute server-side
      setEditingPrice(false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update price');
    } finally {
      setSavingCost(false);
    }
  }

  function categoryIdForType(type) {
    const match = categories.find((c) => c.type === type);
    return match ? match.id : null;
  }

  // type: 'materials' | 'overhead'
  function openCostFieldEditor(type, label, costId, currentAmount) {
    setEditingField({ type, label, costId, categoryId: categoryIdForType(type) });
    setFieldInput(currentAmount ? String(currentAmount) : '');
  }

  async function handleSaveCostField() {
    if (!editingField) return;
    const { type, costId, categoryId } = editingField;
    const trimmed = fieldInput.trim();
    const value = trimmed === '' ? 0 : Number(trimmed);
    if (Number.isNaN(value) || value < 0) {
      Alert.alert('Invalid amount', 'Enter a non-negative dollar amount, or leave it blank to clear.');
      return;
    }
    if (value > 0 && !costId && !categoryId) {
      Alert.alert('Error', `Could not resolve the ${type} cost category. Pull to refresh and try again.`);
      return;
    }
    setSavingCost(true);
    try {
      if (costId) {
        // Existing line: update its amount, or remove it when cleared to $0.
        if (value === 0) {
          await deleteJobCost(user.businessId, selectionCycleId, costId);
        } else {
          await updateJobCost(user.businessId, selectionCycleId, costId, { amount: value });
        }
      } else if (value > 0) {
        // No line yet: create one under the right system category.
        await addJobCost(user.businessId, selectionCycleId, { costCategoryId: categoryId, amount: value });
      }
      await fetchCosts(); // refetch so total / margin recompute server-side
      setEditingField(null);
    } catch (err) {
      Alert.alert('Error', err.message || `Failed to update ${type}`);
    } finally {
      setSavingCost(false);
    }
  }

  // Fall back to params while loading so header renders immediately
  const displayDate = currentServiceDate || paramServiceDate;
  const displayStatus = detail?.status || paramStatus;
  const displayCycleName = detail?.serviceCycleName || paramCycleName;
  const displayDeadline = detail?.submissionDeadline || paramDeadline;
  const isOpen = displayStatus === 'open';
  const hasTasks = detail?.selectedTasks && detail.selectedTasks.length > 0;

  // Job costing (D3: auto labor is individual-only in v1 — team-assigned jobs have no auto lines)
  const isTeamAssigned = !!detail?.team && !detail?.teamMember;
  const laborLines = costs?.laborLines || [];
  const laborSubtotal = laborLines.reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const priceSet = costs?.price !== null && costs?.price !== undefined;
  const hasUnratedLabor = laborLines.some(
    (l) => l.hourlyRate === null || l.hourlyRate === undefined
  );

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

            {/* Job Costing */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Job Costing</Text>

              {/* Price */}
              <TouchableOpacity style={styles.detailRow} onPress={openPriceEditor} activeOpacity={0.6}>
                <Text style={styles.detailLabel}>Price</Text>
                <View style={styles.editableValueWrap}>
                  <Text style={[styles.detailValueInline, !priceSet && styles.valueUnset]}>
                    {priceSet ? money(costs.price) : 'Set price'}
                  </Text>
                  <Text style={styles.editHint}>Edit</Text>
                </View>
              </TouchableOpacity>

              {/* Labor */}
              <View style={styles.costGroup}>
                <Text style={styles.costGroupLabel}>Labor</Text>
                {isTeamAssigned ? (
                  <View style={styles.emptyRowFlush}>
                    <Text style={styles.emptyText}>
                      Automatic labor tracking is individual-only for now. Add labor
                      costs manually for team-assigned jobs.
                    </Text>
                  </View>
                ) : laborLines.length > 0 ? (
                  <>
                    <View style={[styles.laborRow, styles.laborHeaderRow]}>
                      <Text style={[styles.laborCell, styles.laborMemberCell, styles.laborHeadText]}>Member</Text>
                      <Text style={[styles.laborCell, styles.laborNumCell, styles.laborHeadText]}>Est</Text>
                      <Text style={[styles.laborCell, styles.laborNumCell, styles.laborHeadText]}>Actual</Text>
                      <Text style={[styles.laborCell, styles.laborNumCell, styles.laborHeadText]}>Rate</Text>
                      <Text style={[styles.laborCell, styles.laborNumCell, styles.laborHeadText]}>Cost</Text>
                    </View>
                    {laborLines.map((line) => (
                      <View key={line.costId} style={styles.laborRow}>
                        <View style={[styles.laborCell, styles.laborMemberCell]}>
                          <Text style={styles.laborMemberName} numberOfLines={1}>
                            {line.memberName || '—'}
                          </Text>
                          <View style={[
                            styles.sourceBadge,
                            line.source === 'manual' ? styles.sourceBadgeManual : styles.sourceBadgeAuto,
                          ]}>
                            <Text style={[
                              styles.sourceBadgeText,
                              line.source === 'manual' ? styles.sourceBadgeManualText : styles.sourceBadgeAutoText,
                            ]}>
                              {line.source === 'manual' ? 'Edited' : 'Auto-tracked'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.laborCell, styles.laborNumCell, styles.laborNumText]}>
                          {formatHours(costs?.estimatedHours)}
                        </Text>
                        <Text style={[styles.laborCell, styles.laborNumCell, styles.laborNumText]}>
                          {formatHours(line.hoursActual)}
                        </Text>
                        <Text style={[styles.laborCell, styles.laborNumCell, styles.laborNumText]}>
                          {line.hourlyRate === null || line.hourlyRate === undefined
                            ? '—'
                            : money(line.hourlyRate)}
                        </Text>
                        <Text style={[styles.laborCell, styles.laborNumCell, styles.laborNumText]}>
                          {money(line.amount)}
                        </Text>
                      </View>
                    ))}
                    <View style={[styles.laborRow, styles.laborSubtotalRow]}>
                      <Text style={[styles.laborCell, styles.laborMemberCell, styles.laborSubtotalLabel]}>
                        Subtotal
                      </Text>
                      <Text style={[styles.laborCell, styles.laborNumCell]} />
                      <Text style={[styles.laborCell, styles.laborNumCell]} />
                      <Text style={[styles.laborCell, styles.laborNumCell]} />
                      <Text style={[styles.laborCell, styles.laborNumCell, styles.laborSubtotalValue]}>
                        {money(laborSubtotal)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyRowFlush}>
                    <Text style={styles.emptyText}>No labor recorded yet</Text>
                  </View>
                )}

                {hasUnratedLabor ? (
                  <View style={styles.warnBanner}>
                    <Text style={styles.warnBannerText}>
                      A team member has no hourly rate set — their labor is counted as
                      $0.00. Set the rate on their profile to calculate labor cost.
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Materials */}
              <TouchableOpacity
                style={styles.detailRow}
                activeOpacity={0.6}
                onPress={() => openCostFieldEditor('materials', 'Materials', costs?.materialsCostId, costs?.materialsAmount)}
              >
                <Text style={styles.detailLabel}>Materials</Text>
                <View style={styles.editableValueWrap}>
                  <Text style={styles.detailValueInline}>{money(costs?.materialsAmount)}</Text>
                  <Text style={styles.editHint}>Edit</Text>
                </View>
              </TouchableOpacity>

              {/* Overhead */}
              <TouchableOpacity
                style={styles.detailRow}
                activeOpacity={0.6}
                onPress={() => openCostFieldEditor('overhead', 'Overhead', costs?.overheadCostId, costs?.overheadAmount)}
              >
                <Text style={styles.detailLabel}>Overhead</Text>
                <View style={styles.editableValueWrap}>
                  <Text style={styles.detailValueInline}>{money(costs?.overheadAmount)}</Text>
                  <Text style={styles.editHint}>Edit</Text>
                </View>
              </TouchableOpacity>

              {/* Total Cost */}
              <View style={[styles.detailRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Cost</Text>
                <Text style={styles.totalValue}>{money(costs?.totalCost)}</Text>
              </View>

              {/* Margin */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Margin</Text>
                {priceSet ? (
                  <Text style={[
                    styles.detailValue,
                    Number(costs?.marginDollars) < 0 ? styles.marginNegative : styles.marginPositive,
                  ]}>
                    {money(costs?.marginDollars)}
                    {costs?.marginPercent !== null && costs?.marginPercent !== undefined
                      ? ` (${Number(costs.marginPercent).toFixed(1)}%)`
                      : ''}
                  </Text>
                ) : (
                  <Text style={[styles.detailValue, styles.marginUnset]}>Price not set</Text>
                )}
              </View>
            </View>
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

      {/* Job Price Editor Modal */}
      <Modal visible={editingPrice} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Job Price</Text>
            <Text style={styles.modalSubtitle}>
              Amount charged to the customer for this job. Leave blank to clear the price.
            </Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.amountPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={priceInput}
                onChangeText={setPriceInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                autoFocus
                editable={!savingCost}
              />
            </View>
            <TouchableOpacity
              style={[styles.modalSave, savingCost && styles.modalSaveDisabled]}
              onPress={handleSavePrice}
              disabled={savingCost}
            >
              {savingCost
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalSaveText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setEditingPrice(false)}
              disabled={savingCost}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Materials / Overhead Amount Editor Modal */}
      <Modal visible={!!editingField} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingField?.label} Cost</Text>
            <Text style={styles.modalSubtitle}>
              Total {editingField?.label?.toLowerCase()} cost for this job. Leave blank to clear it.
            </Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.amountPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={fieldInput}
                onChangeText={setFieldInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                autoFocus
                editable={!savingCost}
              />
            </View>
            <TouchableOpacity
              style={[styles.modalSave, savingCost && styles.modalSaveDisabled]}
              onPress={handleSaveCostField}
              disabled={savingCost}
            >
              {savingCost
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalSaveText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setEditingField(null)}
              disabled={savingCost}
            >
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

  // Job Costing
  costGroup: {
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  costGroupLabel: {
    fontSize: 14, color: '#6b7280', marginBottom: 6,
  },
  emptyRowFlush: { paddingVertical: 6 },

  laborRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 7,
  },
  laborHeaderRow: {
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 6,
  },
  laborCell: { paddingRight: 4 },
  laborMemberCell: { flex: 2.2 },
  laborNumCell: { flex: 1, textAlign: 'right' },
  laborHeadText: {
    fontSize: 11, fontWeight: '600', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'right',
  },
  laborNumText: { fontSize: 13, color: '#1a1a1a', textAlign: 'right' },
  laborMemberName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },

  sourceBadge: {
    alignSelf: 'flex-start', marginTop: 3,
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  sourceBadgeAuto: { backgroundColor: 'rgba(37,99,235,0.1)' },
  sourceBadgeManual: { backgroundColor: '#fef3c7' },
  sourceBadgeText: { fontSize: 10, fontWeight: '600' },
  sourceBadgeAutoText: { color: '#2563eb' },
  sourceBadgeManualText: { color: '#92400e' },

  laborSubtotalRow: {
    borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8, marginTop: 2,
  },
  laborSubtotalLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  laborSubtotalValue: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', textAlign: 'right' },

  warnBanner: {
    marginTop: 10, backgroundColor: '#fef3c7', borderRadius: 8, padding: 10,
  },
  warnBannerText: { fontSize: 12, color: '#92400e', lineHeight: 17 },

  totalRow: { borderTopWidth: 1.5, borderTopColor: '#e5e7eb' },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  totalValue: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },

  marginPositive: { color: '#059669' },
  marginNegative: { color: '#dc2626' },
  marginUnset: { color: '#9ca3af', fontStyle: 'italic' },

  // Editable rows
  editableValueWrap: {
    flexDirection: 'row', alignItems: 'center',
    flex: 1, justifyContent: 'flex-end', marginLeft: 16,
  },
  detailValueInline: { fontSize: 14, color: '#1a1a1a', fontWeight: '500', textAlign: 'right' },
  valueUnset: { color: '#9ca3af', fontStyle: 'italic' },
  editHint: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginLeft: 12 },

  // Amount editor modal
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
