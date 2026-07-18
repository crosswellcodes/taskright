import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function ServiceDaySnapshotScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { date, forecastItem } = route.params;

  const total      = (forecastItem?.customerSelectionsStatus?.submitted ?? 0)
                   + (forecastItem?.customerSelectionsStatus?.pending   ?? 0);
  const submitted  = forecastItem?.customerSelectionsStatus?.submitted ?? 0;
  const pending    = forecastItem?.customerSelectionsStatus?.pending   ?? 0;
  const totalHours = forecastItem?.totalHours ?? 0;
  const cycles     = forecastItem?.serviceCycles ?? [];
  const hasData    = forecastItem && total > 0;

  // Return to the AssignCycle screen we came from with the confirmed date.
  // React Navigation v7: `navigate` only reuses an existing screen when its
  // params also match — since AssignCycle was opened with {customerId,…} and we
  // pass {confirmedDate}, navigate would PUSH a fresh (blank) AssignCycle. Use
  // `popTo` (matches by name only) + merge:true so we pop back to the original
  // screen and keep its params, just adding confirmedDate.
  function handleConfirm() {
    navigation.popTo('AssignCycle', { confirmedDate: date }, { merge: true });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
    >
      {/* Date header */}
      <Text style={styles.dateLabel}>{formatDisplayDate(date)}</Text>

      {hasData ? (
        <>
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Day Overview</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{total}</Text>
                <Text style={styles.statLabel}>Service Calls</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Total Hours</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: '#10b981' }]}>{submitted}</Text>
                <Text style={styles.statLabel}>Submitted</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: '#f59e0b' }]}>{pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          </View>

          {/* Active service cycles */}
          {cycles.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Service Cycles</Text>
              {cycles.map(c => {
                const cTotal = (c.pendingCustomers?.length ?? 0) + (c.submittedCustomers?.length ?? 0);
                return (
                  <View key={c.id} style={styles.cycleRow}>
                    <Text style={styles.cycleName}>{c.name}</Text>
                    <Text style={styles.cycleCount}>{cTotal} customer{cTotal !== 1 ? 's' : ''}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No services scheduled</Text>
          <Text style={styles.emptySubtitle}>This date has no existing service calls assigned.</Text>
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
        <Text style={styles.confirmBtnText}>Confirm This Date</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>Choose a Different Date</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  dateLabel: {
    fontSize: 20, fontWeight: '700', color: '#1a1a1a',
    marginBottom: 20, textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#2563eb', borderRadius: 16, padding: 20, marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' },
  section: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
  },
  cycleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  cycleName: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  cycleCount: { fontSize: 13, color: '#6b7280' },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 32,
    alignItems: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  confirmBtn: {
    backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginBottom: 12,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backBtn: {
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  backBtnText: { color: '#6b7280', fontSize: 15, fontWeight: '500' },
});
