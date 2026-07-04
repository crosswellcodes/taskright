import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, TextInput, Modal
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getServiceCycles, assignCycle, getForecast } from '../../api/businessApi';

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
  const next = new Date(tomorrow.getTime() + daysUntil * 24 * 60 * 60 * 1000);
  return next;
}

function formatNextOccurrence(dayOfWeek) {
  const next = getNextOccurrenceDate(dayOfWeek);
  return next.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function AssignCycleScreen({ route, navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { customerId, customerName } = route.params;
  const isDayOfWeek = user.schedulingFormat === 'day_of_week';
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [totalHours, setTotalHours] = useState('');
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [selectedDay, setSelectedDay] = useState(null); // 0–6 for day-of-week format
  const [showCalendar, setShowCalendar] = useState(false);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Receive confirmed date back from ServiceDaySnapshot (avoids passing non-serializable
  // function as a navigation param — uses React Navigation's "returning a result" pattern)
  useEffect(() => {
    if (route.params?.confirmedDate) {
      setStartDate(route.params.confirmedDate);
    }
  }, [route.params?.confirmedDate]);

  useEffect(() => {
    (async () => {
      try {
        const [cyclesData, forecastData] = await Promise.all([
          getServiceCycles(user.businessId),
          getForecast(user.businessId),
        ]);
        setCycles(cyclesData.serviceCycles || []);
        setForecast(forecastData.summary?.upcomingServices || []);
      } catch (err) {
        Alert.alert('Error', err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [user.businessId]);

  const handleAssign = async () => {
    if (!selectedCycleId) return Alert.alert('Error', 'Select a service cycle');
    const hours = parseFloat(totalHours);
    if (!hours || hours <= 0) return Alert.alert('Error', 'Enter a valid number of hours');
    if (isDayOfWeek && selectedDay === null) return Alert.alert('Error', 'Select a service day');
    if (!isDayOfWeek && !startDate) return Alert.alert('Error', 'Select a first service date');

    setSubmitting(true);
    try {
      const payload = isDayOfWeek
        ? { serviceCycleId: selectedCycleId, totalHours: hours, dayOfWeek: selectedDay, startDate }
        : { serviceCycleId: selectedCycleId, totalHours: hours, startDate };
      await assignCycle(user.businessId, customerId, payload);
      navigation.goBack();
    } catch (err) {
      if (err.code === 'ALREADY_ASSIGNED') {
        Alert.alert('Already Assigned', 'This customer is already assigned to this cycle.');
      } else {
        Alert.alert('Error', err.message || 'Failed to assign cycle');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  const today = new Date().toISOString().split('T')[0];

  // Build markedDates for the date-based modal calendar
  const markedDates = {};
  forecast.forEach(item => {
    const key = item.serviceDate ? item.serviceDate.split('T')[0] : null;
    if (!key) return;
    markedDates[key] = { marked: true, dotColor: dayColor(item) };
  });
  markedDates[startDate] = {
    ...(markedDates[startDate] || {}),
    selected: true,
    selectedColor: '#2563eb',
  };

  // Build markedDates for the day-of-week inline calendar
  const dowMarkedDates = {};
  forecast.forEach(item => {
    const key = item.serviceDate ? item.serviceDate.split('T')[0] : null;
    if (!key) return;
    dowMarkedDates[key] = { marked: true, dotColor: dayColor(item) };
  });
  if (selectedDay !== null) {
    // Mark the next 8 occurrences of the chosen weekday with a subtle light-blue dot
    let d = getNextOccurrenceDate(selectedDay);
    for (let i = 0; i < 8; i++) {
      const key = d.toISOString().split('T')[0];
      dowMarkedDates[key] = {
        ...(dowMarkedDates[key] || {}),
        marked: true,
        dotColor: dowMarkedDates[key]?.dotColor || '#93c5fd',
      };
      d = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
  if (startDate) {
    dowMarkedDates[startDate] = {
      ...(dowMarkedDates[startDate] || {}),
      selected: true,
      selectedColor: '#2563eb',
    };
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <Text style={styles.heading}>Assign cycle to {customerName}</Text>

        <Text style={styles.label}>Service Cycle</Text>
        {cycles.length === 0 ? (
          <Text style={styles.noCycles}>No service cycles yet. Create one in the Cycles tab.</Text>
        ) : (
          cycles.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.cycleOption, selectedCycleId === c.id && styles.cycleOptionSelected]}
              onPress={() => setSelectedCycleId(c.id)}
            >
              <Text style={[styles.cycleName, selectedCycleId === c.id && styles.cycleNameSelected]}>{c.name}</Text>
              <Text style={styles.cycleFreq}>{c.frequency}</Text>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.label}>Hours per Visit</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2.5"
          value={totalHours}
          onChangeText={setTotalHours}
          keyboardType="decimal-pad"
        />

        {isDayOfWeek ? (
          <>
            <Text style={styles.label}>Service Day</Text>
            <View style={styles.dayRow}>
              {DAY_SHORT.map((d, i) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayBtn, selectedDay === i && styles.dayBtnActive]}
                  onPress={() => {
                    setSelectedDay(i);
                    // Auto-set startDate to the next occurrence of this day
                    const next = getNextOccurrenceDate(i);
                    setStartDate(next.toISOString().split('T')[0]);
                  }}
                >
                  <Text style={[styles.dayBtnText, selectedDay === i && styles.dayBtnTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedDay !== null && (
              <>
                <View style={styles.inlineCalendarCard}>
                  <Text style={styles.inlineCalendarTitle}>
                    Service Volume — tap a date to set your start
                  </Text>
                  <Calendar
                    current={startDate}
                    minDate={today}
                    markedDates={dowMarkedDates}
                    markingType="dot"
                    renderArrow={(direction) => (
                      <View style={styles.calArrow}>
                        <Text style={styles.calArrowText}>
                          {direction === 'left' ? '‹' : '›'}
                        </Text>
                      </View>
                    )}
                    onDayPress={(day) => {
                      setStartDate(day.dateString);
                    }}
                    theme={{
                      todayTextColor: '#2563eb',
                      selectedDayBackgroundColor: '#2563eb',
                    }}
                  />
                  <View style={styles.legend}>
                    {[
                      { color: '#93c5fd', label: DAY_NAMES[selectedDay] + 's' },
                      { color: '#2563eb', label: 'Pending' },
                      { color: '#f59e0b', label: 'Mixed' },
                      { color: '#10b981', label: 'All submitted' },
                    ].map(({ color, label }) => (
                      <View key={label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: color }]} />
                        <Text style={styles.legendText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={styles.startDateLabel}>
                  Starting: {formatDisplayDate(startDate)}
                </Text>
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.label}>First Service Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowCalendar(true)}>
              <Text style={styles.dateButtonText}>{formatDisplayDate(startDate)}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.btn, (submitting || !selectedCycleId) && styles.btnDisabled]}
          onPress={handleAssign}
          disabled={submitting || !selectedCycleId}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Assign Cycle</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <Text style={styles.calendarTitle}>Select First Service Date</Text>
            <Calendar
              minDate={today}
              markedDates={markedDates}
              markingType="dot"
              onDayPress={(day) => {
                setShowCalendar(false);
                const forecastItem = forecast.find(
                  f => f.serviceDate?.split('T')[0] === day.dateString
                ) || null;
                navigation.navigate('ServiceDaySnapshot', {
                  date: day.dateString,
                  forecastItem,
                });
              }}
              theme={{
                todayTextColor: '#2563eb',
                selectedDayBackgroundColor: '#2563eb',
                arrowColor: '#2563eb',
              }}
            />
            <View style={styles.legend}>
              {[
                { color: '#2563eb', label: 'Pending' },
                { color: '#f59e0b', label: 'Mixed' },
                { color: '#10b981', label: 'All submitted' },
              ].map(({ color, label }) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCalendar(false)}>
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
  heading: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 20 },
  label: { fontSize: 14, color: '#555', marginBottom: 8, marginTop: 16 },
  noCycles: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
  cycleOption: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cycleOptionSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  cycleName: { fontSize: 15, color: '#333', fontWeight: '500' },
  cycleNameSelected: { color: '#2563eb' },
  cycleFreq: { fontSize: 13, color: '#888', textTransform: 'capitalize' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fafafa',
  },
  dateButton: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fafafa',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateButtonText: { fontSize: 16, color: '#1a1a1a' },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 32 },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  calendarModal: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, width: '100%',
  },
  calendarTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 12, textAlign: 'center' },
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#6b7280' },
  cancelBtn: {
    paddingVertical: 12, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  cancelBtnText: { fontSize: 15, color: '#888' },

  // Day-of-week picker
  dayRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dayBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  dayBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  dayBtnText: { fontSize: 12, fontWeight: '500', color: '#555' },
  dayBtnTextActive: { color: '#2563eb', fontWeight: '700' },

  // Calendar navigation arrows
  calArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
    alignItems: 'center', justifyContent: 'center',
  },
  calArrowText: {
    color: '#2563eb', fontSize: 22, fontWeight: '600', lineHeight: 28,
  },

  // Inline calendar (day-of-week mode)
  inlineCalendarCard: {
    marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  inlineCalendarTitle: {
    fontSize: 12, color: '#6b7280', textAlign: 'center',
    paddingTop: 12, paddingHorizontal: 12, paddingBottom: 4,
    fontWeight: '500',
  },
  startDateLabel: {
    fontSize: 13, color: '#2563eb', fontWeight: '600',
    marginTop: 10, marginBottom: 4, textAlign: 'center',
  },
});
