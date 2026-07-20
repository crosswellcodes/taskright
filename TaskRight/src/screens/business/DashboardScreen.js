import React, { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Alert, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../../context/AuthContext';
import { getForecast } from '../../api/businessApi';
import HoursCalendarDay from '../../components/HoursCalendarDay';

// Return a colour for a service day based on submission rate
function dayColor(item) {
  const submitted = item.customerSelectionsStatus?.submitted ?? 0;
  const pending   = item.customerSelectionsStatus?.pending   ?? 0;
  const total     = submitted + pending;
  if (total === 0)       return '#2563eb'; // no data — blue
  if (pending  === 0)    return '#10b981'; // all submitted — green
  if (submitted === 0)   return '#2563eb'; // none submitted — blue
  return '#f59e0b';                        // mixed — amber
}

// Convert any ISO date string to plain YYYY-MM-DD (no timezone shift)
function toDateKey(iso) {
  return iso ? iso.split('T')[0] : null;
}

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'calendar'

  const fetchForecast = useCallback(async () => {
    try {
      const data = await getForecast(user.businessId);
      setForecast(data.summary?.upcomingServices || []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load forecast');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.businessId]);

  useFocusEffect(
    useCallback(() => { fetchForecast(); }, [fetchForecast])
  );

  // ─── Calendar helpers ─────────────────────────────────────────────────────

  // Map YYYY-MM-DD → forecast item for onDayPress lookup
  const serviceDateMap = useMemo(() => {
    const map = {};
    forecast.forEach(item => {
      const key = toDateKey(item.serviceDate);
      if (key) map[key] = item;
    });
    return map;
  }, [forecast]);

  // Build markedDates for react-native-calendars. dotColor carries the status
  // colour so the custom day cell can tint that day's booked-hours figure.
  const markedDates = useMemo(() => {
    const marks = {};
    forecast.forEach(item => {
      const key = toDateKey(item.serviceDate);
      if (!key) return;
      marks[key] = {
        selected: true,
        selectedColor: dayColor(item),
        marked: true,
        dotColor: dayColor(item),
      };
    });
    return marks;
  }, [forecast]);

  // Booked hours per date, for the hours-load indicator in each calendar day cell.
  const hoursByDate = useMemo(() => {
    const map = {};
    forecast.forEach(item => {
      const key = toDateKey(item.serviceDate);
      if (key) map[key] = item.totalHours ?? 0;
    });
    return map;
  }, [forecast]);

  // Submission-status colour per service day, so each date's circle matches the
  // legend (blue = pending, amber = mixed, green = all submitted).
  const colorByDate = useMemo(() => {
    const map = {};
    forecast.forEach(item => {
      const key = toDateKey(item.serviceDate);
      if (key) map[key] = dayColor(item);
    });
    return map;
  }, [forecast]);

  // Today's date string for the calendar's initial month
  const todayString = useMemo(() => toDateKey(new Date().toISOString()), []);

  const handleDayPress = useCallback((day) => {
    const item = serviceDateMap[day.dateString];
    if (item) navigation.navigate('ForecastDay', { item });
  }, [serviceDateMap, navigation]);

  const renderDay = useCallback(
    (props) => (
      <HoursCalendarDay
        {...props}
        hoursByDate={hoursByDate}
        colorByDate={colorByDate}
        onDayPress={handleDayPress}
      />
    ),
    [hoursByDate, colorByDate, handleDayPress]
  );

  // ─── Shared loading / empty states ────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      </SafeAreaView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Fixed header + toggle — sits above the scrollable content */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{user.name}</Text>
          <Text style={styles.subtitle}>30-Day Forecast</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* List / Calendar toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'list' && styles.toggleBtnActive]}
          onPress={() => setView('list')}
        >
          <Text style={[styles.toggleText, view === 'list' && styles.toggleTextActive]}>
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'calendar' && styles.toggleBtnActive]}
          onPress={() => setView('calendar')}
        >
          <Text style={[styles.toggleText, view === 'calendar' && styles.toggleTextActive]}>
            Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── CALENDAR VIEW ─────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchForecast(); }} />}
        >
          <Calendar
            current={todayString}
            markedDates={markedDates}
            dayComponent={renderDay}
            theme={{
              backgroundColor: '#f5f5f5',
              calendarBackground: '#fff',
              textSectionTitleColor: '#888',
              selectedDayBackgroundColor: '#2563eb',
              selectedDayTextColor: '#fff',
              todayTextColor: '#2563eb',
              dayTextColor: '#1a1a1a',
              textDisabledColor: '#d1d5db',
              dotColor: '#2563eb',
              arrowColor: '#2563eb',
              monthTextColor: '#1a1a1a',
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
              textDayFontSize: 15,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
            }}
            style={styles.calendar}
          />

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
              <Text style={styles.legendText}>Pending selections</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Mixed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>All submitted</Text>
            </View>
          </View>

          {/* Upcoming service list below calendar for context */}
          {forecast.length > 0 && (
            <View style={styles.upcomingSection}>
              <Text style={styles.upcomingSectionTitle}>Upcoming Service Dates</Text>
              {forecast.map((item, idx) => {
                const key = toDateKey(item.serviceDate);
                const date = new Date(item.serviceDate).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                });
                const submitted = item.customerSelectionsStatus?.submitted ?? 0;
                const pending   = item.customerSelectionsStatus?.pending   ?? 0;
                const total     = submitted + pending;
                const color     = dayColor(item);
                return (
                  <TouchableOpacity
                    key={key || idx}
                    style={styles.upcomingRow}
                    onPress={() => navigation.navigate('ForecastDay', { item })}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.upcomingDot, { backgroundColor: color }]} />
                    <Text style={styles.upcomingDate}>{date}</Text>
                    <Text style={styles.upcomingCycle} numberOfLines={1}>
                      {(item.serviceCycles || []).map(c => c.name).filter(Boolean).join(', ')}
                    </Text>
                    <Text style={styles.upcomingCount}>{total} customer{total !== 1 ? 's' : ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── LIST VIEW ─────────────────────────────────────────────────── */}
      {view === 'list' && (
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchForecast(); }} />}
        >
          {forecast.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No upcoming services in the next 30 days.</Text>
            </View>
          ) : (
            forecast.map((item, idx) => {
              const date = new Date(item.serviceDate).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              });
              const submitted     = item.customerSelectionsStatus?.submitted ?? 0;
              const pending       = item.customerSelectionsStatus?.pending   ?? 0;
              const totalCustomers = submitted + pending;
              const submitRate    = totalCustomers > 0
                ? Math.round((submitted / totalCustomers) * 100)
                : 0;

              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.card}
                  onPress={() => navigation.navigate('ForecastDay', { item })}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardDate}>{date}</Text>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{totalCustomers}</Text>
                      <Text style={styles.statLabel}>Customers</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{submitted}</Text>
                      <Text style={styles.statLabel}>Submitted</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{pending}</Text>
                      <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{submitRate}%</Text>
                      <Text style={styles.statLabel}>Rate</Text>
                    </View>
                  </View>

                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${submitRate}%` }]} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  title:    { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 2 },
  signOut:  { color: '#2563eb', fontSize: 15, marginTop: 4 },

  // ── Toggle ───────────────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#e5e7eb', borderRadius: 10, padding: 3,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleText:       { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  toggleTextActive: { color: '#1a1a1a' },

  // ── Calendar view ────────────────────────────────────────────────────────
  calendar: {
    marginHorizontal: 16, borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    marginTop: 12, marginBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#888' },
  upcomingSection: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
    borderRadius: 12, padding: 16,
  },
  upcomingSectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  upcomingRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 10,
  },
  upcomingDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  upcomingDate:  { fontSize: 14, fontWeight: '600', color: '#1a1a1a', width: 80 },
  upcomingCycle: { flex: 1, fontSize: 13, color: '#888' },
  upcomingCount: { fontSize: 13, color: '#2563eb', fontWeight: '600' },

  // ── List view ────────────────────────────────────────────────────────────
  empty:        { padding: 40, alignItems: 'center' },
  emptyText:    { fontSize: 15, color: '#888', textAlign: 'center' },
  card:         { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10, borderRadius: 12, padding: 16 },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardDate:     { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  cardCycle:    { fontSize: 13, color: '#888' },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  stat:         { alignItems: 'center' },
  statValue:    { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  statLabel:    { fontSize: 11, color: '#888', marginTop: 2 },
  progressBg:   { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 3 },
});
