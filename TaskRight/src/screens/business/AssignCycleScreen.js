import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, TextInput, Modal
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import AssigneePicker from '../../components/AssigneePicker';
import HoursCalendarDay from '../../components/HoursCalendarDay';
import {
  getServiceTemplates, getForecast, createServiceTemplate,
  createCustomerService, getCustomerService, updateCustomerService, deleteCustomerService,
  getTeamMembers, getTeamGroups,
} from '../../api/businessApi';

// Server generates 4 Service Calls for a recurring service, 1 for a one_time sale
// (see generateUpcomingSelectionCycles). Used for the frequency-aware assign copy.
const RECURRING_CALL_COUNT = 4;

// Picklist saves vertical space vs. a chip row and makes room for the one-time option.
const FREQUENCY_OPTIONS = [
  { value: 'one_time', label: 'One-time (single visit)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];
const frequencyLabel = (v) => FREQUENCY_OPTIONS.find(o => o.value === v)?.label || v;

function getDefaultStartDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function dayColor(item) {
  const submitted = item.customerSelectionsStatus?.submitted ?? 0;
  const pending   = item.customerSelectionsStatus?.pending   ?? 0;
  const total     = submitted + pending;
  if (total === 0 || submitted === 0) return '#2563eb';
  if (pending === 0)                  return '#10b981';
  return '#f59e0b';
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getNextOccurrenceDate(dayOfWeek) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const daysUntil = (dayOfWeek - tomorrow.getDay() + 7) % 7;
  return new Date(tomorrow.getTime() + daysUntil * 24 * 60 * 60 * 1000);
}

export default function AssignCycleScreen({ route, navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { customerId, customerName, serviceId } = route.params;
  const isEdit = serviceId != null;
  const isDayOfWeek = user.schedulingFormat === 'day_of_week';

  // Definition
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  // Tasks are OWNED by this service (SERVICE_TASK_OWNERSHIP.md). Each row:
  // { id?, name, timeAllotmentMinutes, _key }. `id` present ⇒ existing service_task
  // (diff-upserted server-side); absent ⇒ new. `_key` is a stable local list key.
  const [serviceTasks, setServiceTasks] = useState([]);
  const [totalHours, setTotalHours] = useState('');
  const [deadlineDays, setDeadlineDays] = useState('3');
  const [autoRepeatDays, setAutoRepeatDays] = useState('1'); // carried through; feeds save-as-template
  const [pricePerVisit, setPricePerVisit] = useState('');

  // Schedule (create mode only)
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [selectedDay, setSelectedDay] = useState(null); // 0–6 for day-of-week format
  const [showCalendar, setShowCalendar] = useState(false);

  // Assign (create mode only) — optional, set-only. `assignee` holds the pending
  // { type:'member'|'group', id, name } | null, applied atomically on Create.
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamGroups, setTeamGroups] = useState([]);
  const [assignee, setAssignee] = useState(null);

  // Data
  const [templates, setTemplates] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Inline task add/edit (local only — no server round-trip until Save)
  const keyRef = useRef(1);
  const makeKey = () => `t${keyRef.current++}`;
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskMinutes, setNewTaskMinutes] = useState('');
  const [editingKey, setEditingKey] = useState(null); // null ⇒ adding; else the _key being edited

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Service' : 'Add Service' });
  }, [navigation, isEdit]);

  // Receive confirmed date back from ServiceDaySnapshot (avoids passing a
  // non-serializable function as a nav param — "returning a result" pattern)
  useEffect(() => {
    if (route.params?.confirmedDate) setStartDate(route.params.confirmedDate);
  }, [route.params?.confirmedDate]);

  useEffect(() => {
    (async () => {
      try {
        const [templateData, forecastData, membersData, groupsData] = await Promise.all([
          getServiceTemplates(user.businessId),
          isEdit ? Promise.resolve(null) : getForecast(user.businessId),
          isEdit ? Promise.resolve(null) : getTeamMembers(user.businessId),
          isEdit ? Promise.resolve(null) : getTeamGroups(user.businessId),
        ]);
        setTemplates(templateData.serviceTemplates || []);
        if (forecastData) setForecast(forecastData.summary?.upcomingServices || []);
        if (membersData) setTeamMembers(membersData.teamMembers || []);
        if (groupsData) setTeamGroups(groupsData.groups || []);

        if (isEdit) {
          const { service } = await getCustomerService(user.businessId, customerId, serviceId);
          setName(service.name || '');
          setFrequency(service.frequency || 'weekly');
          setServiceTasks((service.tasks || []).map(t => ({
            id: t.id, name: t.name, timeAllotmentMinutes: t.timeAllotmentMinutes, _key: makeKey(),
          })));
          setTotalHours(service.totalHours != null ? String(service.totalHours) : '');
          setDeadlineDays(service.daysBeforeServiceDeadline != null ? String(service.daysBeforeServiceDeadline) : '3');
          setAutoRepeatDays(service.daysBeforeAutoRepeat != null ? String(service.daysBeforeAutoRepeat) : '1');
          setPricePerVisit(service.pricePerVisit != null ? String(service.pricePerVisit) : '');
        }
      } catch (err) {
        Alert.alert('Error', err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [user.businessId, customerId, serviceId, isEdit]);

  // Booked hours per date (across all services) for the create-flow calendars.
  const hoursByDate = useMemo(() => {
    const map = {};
    forecast.forEach(item => {
      const key = item.serviceDate ? item.serviceDate.split('T')[0] : null;
      if (key) map[key] = item.totalHours ?? 0;
    });
    return map;
  }, [forecast]);

  // Date-based first-service-date pick → review the day's snapshot before committing.
  const handleFirstDatePick = useCallback((day) => {
    setShowCalendar(false);
    const forecastItem = forecast.find(f => f.serviceDate?.split('T')[0] === day.dateString) || null;
    navigation.navigate('ServiceDaySnapshot', { date: day.dateString, forecastItem });
  }, [forecast, navigation]);

  // Day-of-week inline pick → just set the start date.
  const handleDowDatePick = useCallback((day) => {
    setStartDate(day.dateString);
  }, []);

  const renderFirstDateDay = useCallback(
    (props) => <HoursCalendarDay {...props} hoursByDate={hoursByDate} onDayPress={handleFirstDatePick} />,
    [hoursByDate, handleFirstDatePick]
  );
  const renderDowDay = useCallback(
    (props) => <HoursCalendarDay {...props} hoursByDate={hoursByDate} onDayPress={handleDowDatePick} />,
    [hoursByDate, handleDowDatePick]
  );

  const openAddTask = () => {
    setEditingKey(null);
    setNewTaskName('');
    setNewTaskMinutes('');
    setTaskModalVisible(true);
  };

  const openEditTask = (item) => {
    setEditingKey(item._key);
    setNewTaskName(item.name);
    setNewTaskMinutes(String(item.timeAllotmentMinutes));
    setTaskModalVisible(true);
  };

  // Add or update a task row — purely local; persisted on Save via the `tasks` payload.
  const handleSaveTask = () => {
    if (!newTaskName.trim()) return Alert.alert('Error', 'Enter a task name');
    const mins = parseInt(newTaskMinutes, 10);
    if (!mins || mins <= 0) return Alert.alert('Error', 'Enter a valid number of minutes');
    const value = { name: newTaskName.trim(), timeAllotmentMinutes: mins };
    if (editingKey != null) {
      // Preserve id + _key so an existing service_task is updated in place (stable id).
      setServiceTasks(prev => prev.map(t => t._key === editingKey ? { ...t, ...value } : t));
    } else {
      setServiceTasks(prev => [...prev, { ...value, _key: makeKey() }]);
    }
    setTaskModalVisible(false);
  };

  const removeTask = (key) => setServiceTasks(prev => prev.filter(t => t._key !== key));

  function applyTemplate(t) {
    setName(t.name || '');
    setFrequency(t.frequency || 'weekly');
    // Copy the template's tasks into fresh service_task rows (drop template ids).
    setServiceTasks((t.tasks || []).map(tk => ({
      name: tk.name, timeAllotmentMinutes: tk.timeAllotmentMinutes, _key: makeKey(),
    })));
    if (t.daysBeforeServiceDeadline != null) setDeadlineDays(String(t.daysBeforeServiceDeadline));
    setShowTemplatePicker(false);
  }

  function parsePrice() {
    const trimmed = pricePerVisit.trim();
    if (trimmed === '') return null;
    const v = Number(trimmed);
    return Number.isNaN(v) || v < 0 ? undefined : v; // undefined => invalid
  }

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Enter a service name');
    const hours = parseFloat(totalHours);
    if (!hours || hours <= 0) return Alert.alert('Error', 'Enter a valid number of hours');
    const price = parsePrice();
    if (price === undefined) return Alert.alert('Error', 'Enter a valid price, or leave it blank');
    const deadline = deadlineDays.trim() === '' ? undefined : parseInt(deadlineDays, 10);
    if (deadline !== undefined && (Number.isNaN(deadline) || deadline < 0)) {
      return Alert.alert('Error', 'Deadline days must be a non-negative whole number');
    }

    const base = {
      name: name.trim(),
      frequency,
      tasks: serviceTasks.map(t => ({
        ...(t.id != null ? { id: t.id } : {}),
        name: t.name,
        timeAllotmentMinutes: t.timeAllotmentMinutes,
      })),
      totalHours: hours,
      pricePerVisit: price,
      ...(deadline !== undefined ? { daysBeforeServiceDeadline: deadline } : {}),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateCustomerService(user.businessId, customerId, serviceId, base);
      } else {
        if (isDayOfWeek && selectedDay === null) { setSubmitting(false); return Alert.alert('Error', 'Select a service day'); }
        if (!isDayOfWeek && !startDate) { setSubmitting(false); return Alert.alert('Error', 'Select a first service date'); }
        await createCustomerService(user.businessId, customerId, {
          ...base,
          startDate,
          ...(isDayOfWeek ? { dayOfWeek: selectedDay } : {}),
          // Optional atomic assignee — fans out to all generated open Calls server-side.
          ...(assignee
            ? { assignee: assignee.type === 'group' ? { teamId: assignee.id } : { teamMemberId: assignee.id } }
            : {}),
        });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save service');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Service', 'This removes the service and its upcoming service calls. Completed calls block deletion.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try {
            await deleteCustomerService(user.businessId, customerId, serviceId);
            navigation.goBack();
          } catch (err) {
            if (err.code === 'HAS_HISTORY') {
              Alert.alert('Cannot delete', 'This service has completed service calls, so its history is preserved.');
            } else {
              Alert.alert('Error', err.message || 'Failed to delete service');
            }
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  // Snapshot this Service's definition into the reusable template library
  // (definition-only: name/frequency/deadlines/tasks — no per-customer hours/price).
  const handleSaveAsTemplate = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Enter a service name first');
    const deadline = deadlineDays.trim() === '' ? 3 : (parseInt(deadlineDays, 10) || 3);
    const repeat = autoRepeatDays.trim() === '' ? 1 : (parseInt(autoRepeatDays, 10) || 1);
    setSubmitting(true);
    try {
      await createServiceTemplate(user.businessId, {
        name: name.trim(),
        frequency,
        daysBeforeServiceDeadline: deadline,
        daysBeforeAutoRepeat: repeat,
        // Template tasks are fresh copies (definition-only) — drop per-service ids.
        tasks: serviceTasks.map(t => ({ name: t.name, timeAllotmentMinutes: t.timeAllotmentMinutes })),
      });
      Alert.alert('Saved as Template', `"${name.trim()}" is now reusable from the Templates tab.`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  const today = new Date().toISOString().split('T')[0];

  // markedDates for the date-based modal calendar
  const markedDates = {};
  forecast.forEach(item => {
    const key = item.serviceDate ? item.serviceDate.split('T')[0] : null;
    if (key) markedDates[key] = { marked: true, dotColor: dayColor(item) };
  });
  markedDates[startDate] = { ...(markedDates[startDate] || {}), selected: true, selectedColor: '#2563eb' };

  // markedDates for the day-of-week inline calendar
  const dowMarkedDates = {};
  forecast.forEach(item => {
    const key = item.serviceDate ? item.serviceDate.split('T')[0] : null;
    if (key) dowMarkedDates[key] = { marked: true, dotColor: dayColor(item) };
  });
  if (selectedDay !== null) {
    let d = getNextOccurrenceDate(selectedDay);
    for (let i = 0; i < 8; i++) {
      const key = d.toISOString().split('T')[0];
      dowMarkedDates[key] = { ...(dowMarkedDates[key] || {}), marked: true, dotColor: dowMarkedDates[key]?.dotColor || '#93c5fd' };
      d = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
  if (startDate) {
    dowMarkedDates[startDate] = { ...(dowMarkedDates[startDate] || {}), selected: true, selectedColor: '#2563eb' };
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <Text style={styles.heading}>{isEdit ? 'Edit service for' : 'New service for'} {customerName}</Text>

        {!isEdit && templates.length > 0 && (
          <TouchableOpacity style={styles.templateBtn} onPress={() => setShowTemplatePicker(true)}>
            <Text style={styles.templateBtnText}>Start from a template ›</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Service Name</Text>
        <TextInput style={styles.input} placeholder="e.g. Weekly Cleaning" value={name} onChangeText={setName} />

        <Text style={styles.label}>Frequency</Text>
        <TouchableOpacity style={styles.dropdown} onPress={() => setShowFrequencyPicker(true)}>
          <Text style={styles.dropdownText}>{frequencyLabel(frequency)}</Text>
          <Text style={styles.dropdownChevron}>▾</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Tasks</Text>
        <Text style={styles.hint}>Tasks belong to this service. Editing them affects only {customerName}.</Text>
        {serviceTasks.length === 0 ? (
          <Text style={styles.noneText}>No tasks yet — add one below.</Text>
        ) : (
          serviceTasks.map(t => (
            <View key={t._key} style={styles.taskRow}>
              <TouchableOpacity style={styles.taskRowMain} onPress={() => openEditTask(t)}>
                <Text style={styles.taskName}>{t.name}</Text>
                <Text style={styles.taskTime}>{t.timeAllotmentMinutes} min · tap to edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.removeTaskBtn} onPress={() => removeTask(t._key)}>
                <Text style={styles.removeTaskText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
        <TouchableOpacity style={styles.addTaskRow} onPress={openAddTask}>
          <Text style={styles.addTaskRowText}>+ New task</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Hours per Visit</Text>
        <TextInput style={styles.input} placeholder="e.g. 2.5" value={totalHours} onChangeText={setTotalHours} keyboardType="decimal-pad" />

        <Text style={styles.label}>Selection Deadline (days before service)</Text>
        <TextInput style={styles.input} placeholder="3" value={deadlineDays} onChangeText={setDeadlineDays} keyboardType="number-pad" />

        <Text style={styles.label}>Price for Visit (optional)</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountPrefix}>$</Text>
          <TextInput style={styles.amountInput} placeholder="0.00" value={pricePerVisit} onChangeText={setPricePerVisit} keyboardType="decimal-pad" />
        </View>
        <Text style={styles.hint}>Applied to the service call(s) — works for a one-time sale or a recurring service. Leave blank to clear.</Text>

        {isEdit ? (
          <Text style={styles.editNote}>
            Editing updates this service's definition. Scheduled service calls keep their dates;
            a deadline change updates upcoming (open) calls.
          </Text>
        ) : isDayOfWeek ? (
          <>
            <Text style={styles.label}>Service Day</Text>
            <View style={styles.dayRow}>
              {DAY_SHORT.map((d, i) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayBtn, selectedDay === i && styles.dayBtnActive]}
                  onPress={() => { setSelectedDay(i); setStartDate(getNextOccurrenceDate(i).toISOString().split('T')[0]); }}
                >
                  <Text style={[styles.dayBtnText, selectedDay === i && styles.dayBtnTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedDay !== null && (
              <>
                <View style={styles.inlineCalendarCard}>
                  <Text style={styles.inlineCalendarTitle}>Service Volume — tap a date to set your start</Text>
                  <Calendar
                    current={startDate}
                    minDate={today}
                    markedDates={dowMarkedDates}
                    dayComponent={renderDowDay}
                    renderArrow={(direction) => (
                      <View style={styles.calArrow}><Text style={styles.calArrowText}>{direction === 'left' ? '‹' : '›'}</Text></View>
                    )}
                    theme={{ todayTextColor: '#2563eb', selectedDayBackgroundColor: '#2563eb' }}
                  />
                </View>
                <Text style={styles.startDateLabel}>Starting: {formatDisplayDate(startDate)}</Text>
                {/* Parity with the date-based flow: review what's already scheduled on
                    the chosen start date before committing (DOW_DAY_SNAPSHOT.md). */}
                <TouchableOpacity
                  style={styles.reviewDayBtn}
                  onPress={() => {
                    const forecastItem = forecast.find(f => f.serviceDate?.split('T')[0] === startDate) || null;
                    navigation.navigate('ServiceDaySnapshot', { date: startDate, forecastItem });
                  }}
                >
                  <Text style={styles.reviewDayBtnText}>
                    Review {DAY_NAMES[selectedDay]} — see what's scheduled ›
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.label}>{frequency === 'one_time' ? 'Service Date' : 'First Service Date'}</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowCalendar(true)}>
              <Text style={styles.dateButtonText}>{formatDisplayDate(startDate)}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Assign (optional) — create mode only; hidden when the business has no team.
            Sets one person/group across the generated Calls (applied on Create). */}
        {!isEdit && (teamMembers.length > 0 || teamGroups.length > 0) && (
          <>
            <Text style={styles.label}>
              {frequency === 'one_time'
                ? 'Assign to this visit (optional)'
                : `Assign to all ${RECURRING_CALL_COUNT} upcoming visits (optional)`}
            </Text>
            <AssigneePicker
              teamMembers={teamMembers}
              teamGroups={teamGroups}
              value={assignee}
              onChange={setAssignee}
              title="Assign this service"
              style={styles.assigneePill}
            />
            {assignee?.type === 'group' && (
              <Text style={styles.hint}>Each team member's hours are tracked individually and auto-calculate labor cost at their own rate.</Text>
            )}
          </>
        )}

        <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={handleSave} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{isEdit ? 'Save Changes' : 'Create Service'}</Text>}
        </TouchableOpacity>

        {isEdit && (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSaveAsTemplate} disabled={submitting}>
              <Text style={styles.secondaryBtnText}>Save as Template</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={submitting}>
              <Text style={styles.deleteBtnText}>Delete Service</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Date-based first-service-date picker */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <Text style={styles.calendarTitle}>Select First Service Date</Text>
            <Calendar
              minDate={today}
              markedDates={markedDates}
              dayComponent={renderFirstDateDay}
              theme={{ todayTextColor: '#2563eb', selectedDayBackgroundColor: '#2563eb', arrowColor: '#2563eb' }}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCalendar(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Template picker */}
      <Modal visible={showTemplatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <Text style={styles.calendarTitle}>Start from a Template</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {templates.map(t => (
                <TouchableOpacity key={t.id} style={styles.templateOption} onPress={() => applyTemplate(t)}>
                  <Text style={styles.templateName}>{t.name}</Text>
                  <Text style={styles.templateFreq}>{frequencyLabel(t.frequency)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTemplatePicker(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Frequency picklist */}
      <Modal visible={showFrequencyPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFrequencyPicker(false)}>
          <View style={styles.calendarModal}>
            <Text style={styles.calendarTitle}>Frequency</Text>
            {FREQUENCY_OPTIONS.map(o => {
              const on = frequency === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  style={styles.freqOption}
                  onPress={() => { setFrequency(o.value); setShowFrequencyPicker(false); }}
                >
                  <Text style={[styles.freqOptionText, on && styles.freqOptionTextActive]}>{o.label}</Text>
                  {on && <Text style={styles.freqOptionCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Inline task add/edit */}
      <Modal visible={taskModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <Text style={styles.calendarTitle}>{editingKey != null ? 'Edit Task' : 'New Task'}</Text>
            <Text style={styles.label}>Task Name</Text>
            <TextInput style={styles.input} value={newTaskName} onChangeText={setNewTaskName} placeholder="e.g. Vacuum living room" />
            <Text style={styles.label}>Time (minutes)</Text>
            <TextInput style={styles.input} value={newTaskMinutes} onChangeText={setNewTaskMinutes} placeholder="e.g. 30" keyboardType="number-pad" />
            <TouchableOpacity style={[styles.btn, { marginTop: 20 }]} onPress={handleSaveTask}>
              <Text style={styles.btnText}>{editingKey != null ? 'Save Task' : 'Add Task'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setTaskModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  label: { fontSize: 14, color: '#555', marginBottom: 8, marginTop: 16 },
  noneText: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  editNote: { fontSize: 12, color: '#6b7280', marginTop: 20, lineHeight: 18, fontStyle: 'italic' },

  templateBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#eff6ff', borderRadius: 8, marginBottom: 4 },
  templateBtnText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },

  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fafafa' },

  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fafafa' },
  dropdownText: { fontSize: 16, color: '#1a1a1a' },
  dropdownChevron: { fontSize: 14, color: '#6b7280' },
  freqOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  freqOptionText: { fontSize: 16, color: '#333' },
  freqOptionTextActive: { color: '#2563eb', fontWeight: '600' },
  freqOptionCheck: { fontSize: 16, color: '#2563eb', fontWeight: '700' },

  taskRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#eee', borderRadius: 10, padding: 12, marginBottom: 6 },
  taskRowMain: { flex: 1 },
  taskName: { fontSize: 15, color: '#333', fontWeight: '500' },
  taskTime: { fontSize: 12, color: '#888', marginTop: 2 },
  removeTaskBtn: { paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  removeTaskText: { fontSize: 16, color: '#dc2626', fontWeight: '600' },

  addTaskRow: { borderWidth: 1.5, borderColor: '#bfdbfe', borderStyle: 'dashed', borderRadius: 10, padding: 12, marginBottom: 6, alignItems: 'center' },
  addTaskRowText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },

  assigneePill: { alignSelf: 'flex-start', maxWidth: 240, marginTop: 4 },

  amountRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#fafafa' },
  amountPrefix: { fontSize: 16, color: '#6b7280', marginRight: 4 },
  amountInput: { flex: 1, paddingVertical: 12, fontSize: 16 },

  dateButton: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fafafa' },
  dateButtonText: { fontSize: 16, color: '#1a1a1a' },

  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 32 },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 10, borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 10 },
  secondaryBtnText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  deleteBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  deleteBtnText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  calendarModal: { backgroundColor: '#fff', borderRadius: 16, padding: 16, width: '100%' },
  calendarTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 12, textAlign: 'center' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  cancelBtnText: { fontSize: 15, color: '#888' },

  templateOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  templateName: { fontSize: 15, color: '#333', fontWeight: '500' },
  templateFreq: { fontSize: 13, color: '#888', textTransform: 'capitalize' },

  dayRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dayBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fafafa' },
  dayBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  dayBtnText: { fontSize: 12, fontWeight: '500', color: '#555' },
  dayBtnTextActive: { color: '#2563eb', fontWeight: '700' },

  calArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'center', justifyContent: 'center' },
  calArrowText: { color: '#2563eb', fontSize: 22, fontWeight: '600', lineHeight: 28 },

  inlineCalendarCard: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  inlineCalendarTitle: { fontSize: 12, color: '#6b7280', textAlign: 'center', paddingTop: 12, paddingHorizontal: 12, paddingBottom: 4, fontWeight: '500' },
  startDateLabel: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginTop: 10, marginBottom: 4, textAlign: 'center' },
  reviewDayBtn: {
    marginTop: 10, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', alignItems: 'center',
  },
  reviewDayBtnText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
});
