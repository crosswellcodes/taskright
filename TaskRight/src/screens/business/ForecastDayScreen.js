import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import AssigneePicker from '../../components/AssigneePicker';
import {
  getTeamMembers,
  getTeamGroups,
  getAssignmentsForDate,
  upsertServiceAssignment,
  removeServiceAssignment,
} from '../../api/businessApi';

export default function ForecastDayScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { item } = route.params;

  const [teamMembers, setTeamMembers] = useState([]);
  const [teamGroups, setTeamGroups] = useState([]);
  // { [selectionCycleId]: { type: 'member'|'group', id, name } }
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState(null);

  const toggleCollapsed = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(prev => !prev);
  };

  const serviceDate = new Date(item.serviceDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const serviceDateParam = item.serviceDate
    ? item.serviceDate.split('T')[0]
    : null;

  const serviceCycles = item.serviceCycles || [];
  const activeCycles = selectedCycleId
    ? serviceCycles.filter(c => c.id === selectedCycleId)
    : serviceCycles;

  const allCustomers = [
    ...activeCycles.flatMap(cycle =>
      (cycle.pendingCustomers || []).map(c => ({ ...c, status: 'pending', serviceCycleName: cycle.name }))
    ),
    ...activeCycles.flatMap(cycle =>
      (cycle.submittedCustomers || []).map(c => ({ ...c, status: 'submitted', serviceCycleName: cycle.name }))
    ),
  ];

  const total = allCustomers.length;
  const submittedCount = allCustomers.filter(c => c.status === 'submitted').length;
  const pendingCount = allCustomers.filter(c => c.status === 'pending').length;

  // ─── Load team members, groups + existing assignments ─────────────────────

  const loadData = useCallback(async () => {
    try {
      const [membersRes, groupsRes, assignmentsRes] = await Promise.all([
        getTeamMembers(user.businessId),
        getTeamGroups(user.businessId),
        serviceDateParam
          ? getAssignmentsForDate(user.businessId, serviceDateParam)
          : Promise.resolve({ assignments: [] }),
      ]);

      setTeamMembers(membersRes.teamMembers || []);
      setTeamGroups(groupsRes.groups || []);

      // Build map: selectionCycleId → { type, id, name }
      const map = {};
      (assignmentsRes.assignments || []).forEach(a => {
        if (a.teamId) {
          map[a.selectionCycleId] = { type: 'group', id: a.teamId, name: a.teamName };
        } else if (a.teamMemberId) {
          map[a.selectionCycleId] = { type: 'member', id: a.teamMemberId, name: a.teamMemberName };
        }
      });
      setAssignments(map);
    } catch (err) {
      console.error('ForecastDayScreen load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user.businessId, serviceDateParam]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Refresh whenever the screen is focused (e.g. user switches tabs to add a
  // group or member and then comes back — this ensures the latest roster is used)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  // ─── Assign flow (immediate-write; AssigneePicker drives the UI) ──────────
  // The shared controlled picker resolves the two-step ActionSheet and hands us
  // the chosen value (or null on remove); we persist it and update local state.

  const handleAssignChange = async (customer, next) => {
    const cycleId = customer.selectionCycleId;
    if (!cycleId) return;
    try {
      if (next === null) {
        await removeServiceAssignment(user.businessId, cycleId);
        setAssignments(prev => {
          const map = { ...prev };
          delete map[cycleId];
          return map;
        });
      } else {
        const assignee = next.type === 'group' ? { teamId: next.id } : { teamMemberId: next.id };
        await upsertServiceAssignment(user.businessId, cycleId, assignee);
        setAssignments(prev => ({ ...prev, [cycleId]: next }));
      }
    } catch (err) {
      console.error('Assign change error:', err);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
    >
      {/* Header */}
      <View style={styles.dateCard}>
        <Text style={styles.dateText}>{serviceDate}</Text>

        {/* Cycle filter pills — only shown when there are multiple cycles */}
        {serviceCycles.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsRow}
            contentContainerStyle={{ gap: 6 }}
          >
            <TouchableOpacity
              style={[styles.cyclePill, selectedCycleId === null && styles.cyclePillActive]}
              onPress={() => setSelectedCycleId(null)}
            >
              <Text style={[styles.cyclePillText, selectedCycleId === null && styles.cyclePillTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {serviceCycles.map(cycle => (
              <TouchableOpacity
                key={cycle.id}
                style={[styles.cyclePill, selectedCycleId === cycle.id && styles.cyclePillActive]}
                onPress={() => setSelectedCycleId(cycle.id)}
              >
                <Text style={[styles.cyclePillText, selectedCycleId === cycle.id && styles.cyclePillTextActive]}>
                  {cycle.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={styles.summary}>
          {total} customer{total !== 1 ? 's' : ''} · {submittedCount} submitted · {pendingCount} pending
        </Text>
      </View>

      {/* Unified customer list */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={toggleCollapsed}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>Customers</Text>
          <Text style={styles.chevron}>{collapsed ? '▼' : '▲'}</Text>
        </TouchableOpacity>

        {!collapsed && loading && (
          <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 16 }} />
        )}

        {!collapsed && !loading && allCustomers.length === 0 && (
          <Text style={styles.emptyText}>No customers scheduled</Text>
        )}

        {!collapsed && !loading && allCustomers.length > 0 && allCustomers.map((c, idx) => {
          const assigned = c.selectionCycleId ? assignments[c.selectionCycleId] : null;

          return (
            <View
              key={c.id}
              style={[styles.row, idx < allCustomers.length - 1 && styles.rowBorder]}
            >
              {/* Left: name + cycle + status pill */}
              <View style={styles.rowLeft}>
                <View style={styles.nameBlock}>
                  <Text style={styles.customerName}>{c.name}</Text>
                  {(!selectedCycleId && c.serviceCycleName) ? (
                    <Text style={styles.customerCycle}>{c.serviceCycleName}</Text>
                  ) : null}
                </View>
                <View style={[
                  styles.statusPill,
                  c.status === 'submitted' ? styles.pillGreen : styles.pillAmber,
                ]}>
                  <Text style={[
                    styles.statusText,
                    c.status === 'submitted' ? styles.statusTextGreen : styles.statusTextAmber,
                  ]}>
                    {c.status === 'submitted' ? 'Submitted' : 'Pending'}
                  </Text>
                </View>
              </View>

              {/* Right: assign pill (shared controlled picker, immediate-write) */}
              <AssigneePicker
                teamMembers={teamMembers}
                teamGroups={teamGroups}
                value={assigned}
                title={`Assign to ${c.name}`}
                subject={c.name}
                disabled={!c.selectionCycleId}
                onChange={(next) => handleAssignChange(c, next)}
              />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  dateCard: {
    backgroundColor: '#2563eb', borderRadius: 12, padding: 16, marginBottom: 16,
  },
  dateText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  pillsRow: { marginTop: 10, marginBottom: 2 },
  cyclePill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cyclePillActive: { backgroundColor: '#fff' },
  cyclePillText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  cyclePillTextActive: { color: '#2563eb' },
  summary: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chevron: {
    fontSize: 11, color: '#bbb',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
  },
  rowBorder: {
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  nameBlock: { flexDirection: 'column' },
  customerName: { fontSize: 15, color: '#1a1a1a' },
  customerCycle: { fontSize: 11, color: '#888', marginTop: 1 },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  pillAmber: { backgroundColor: '#fef3c7' },
  pillGreen: { backgroundColor: '#d1fae5' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusTextAmber: { color: '#92400e' },
  statusTextGreen: { color: '#065f46' },
  emptyText: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
});
