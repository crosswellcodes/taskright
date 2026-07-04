import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActionSheetIOS, ActivityIndicator, LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
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

  // ─── Two-step assign flow ─────────────────────────────────────────────────

  const handleAssignPress = (customer) => {
    if (!customer.selectionCycleId) return;

    const assigned = assignments[customer.selectionCycleId];
    const hasMembers = teamMembers.length > 0;
    const hasGroups = teamGroups.length > 0;

    if (!hasMembers && !hasGroups) return;

    // Step 1: Person or Group?
    const step1Options = ['Cancel'];
    if (hasMembers) step1Options.push('Assign a Person');
    if (hasGroups) step1Options.push('Assign a Group');
    if (assigned) step1Options.push('Remove Assignment');

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Assign to ${customer.name}`,
        message: assigned
          ? `Currently: ${assigned.name} (${assigned.type === 'group' ? 'Group' : 'Person'})`
          : undefined,
        options: step1Options,
        cancelButtonIndex: 0,
        destructiveButtonIndex: assigned ? step1Options.length - 1 : undefined,
      },
      (step1Index) => {
        if (step1Index === 0) return; // Cancel

        const chosen = step1Options[step1Index];

        if (chosen === 'Remove Assignment') {
          removeServiceAssignment(user.businessId, customer.selectionCycleId)
            .then(() => {
              setAssignments(prev => {
                const next = { ...prev };
                delete next[customer.selectionCycleId];
                return next;
              });
            })
            .catch(err => console.error('Remove assignment error:', err));
          return;
        }

        if (chosen === 'Assign a Person') {
          // Step 2a: pick a team member
          const memberOptions = ['Cancel', ...teamMembers.map(m => m.name)];
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: `Choose a person for ${customer.name}`,
              options: memberOptions,
              cancelButtonIndex: 0,
            },
            async (step2Index) => {
              if (step2Index === 0) return;
              const member = teamMembers[step2Index - 1];
              try {
                await upsertServiceAssignment(
                  user.businessId,
                  customer.selectionCycleId,
                  { teamMemberId: member.id }
                );
                setAssignments(prev => ({
                  ...prev,
                  [customer.selectionCycleId]: { type: 'member', id: member.id, name: member.name },
                }));
              } catch (err) {
                console.error('Assign member error:', err);
              }
            }
          );
          return;
        }

        if (chosen === 'Assign a Group') {
          // Step 2b: pick a group
          const groupOptions = ['Cancel', ...teamGroups.map(g => g.name)];
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: `Choose a group for ${customer.name}`,
              options: groupOptions,
              cancelButtonIndex: 0,
            },
            async (step2Index) => {
              if (step2Index === 0) return;
              const group = teamGroups[step2Index - 1];
              try {
                await upsertServiceAssignment(
                  user.businessId,
                  customer.selectionCycleId,
                  { teamId: group.id }
                );
                setAssignments(prev => ({
                  ...prev,
                  [customer.selectionCycleId]: { type: 'group', id: group.id, name: group.name },
                }));
              } catch (err) {
                console.error('Assign group error:', err);
              }
            }
          );
        }
      }
    );
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
          const isGroup = assigned?.type === 'group';

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

              {/* Right: assign pill */}
              <TouchableOpacity
                onPress={() => handleAssignPress(c)}
                disabled={!c.selectionCycleId || (teamMembers.length === 0 && teamGroups.length === 0)}
                style={[
                  styles.assignPill,
                  assigned
                    ? (isGroup ? styles.assignPillPurple : styles.assignPillGreen)
                    : styles.assignPillGray,
                ]}
              >
                {assigned && isGroup && (
                  <Text style={styles.assignPillIcon}>●●</Text>
                )}
                <Text
                  style={[
                    styles.assignPillText,
                    assigned
                      ? (isGroup ? styles.assignPillTextPurple : styles.assignPillTextGreen)
                      : styles.assignPillTextGray,
                  ]}
                  numberOfLines={1}
                >
                  {assigned ? assigned.name : 'Assign'}
                </Text>
              </TouchableOpacity>
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

  // Assign pill (right side)
  assignPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    maxWidth: 130,
  },
  assignPillGray: { backgroundColor: '#f3f4f6' },
  assignPillGreen: { backgroundColor: '#d1fae5' },
  assignPillPurple: { backgroundColor: '#ede9fe' },
  assignPillIcon: { fontSize: 8, color: '#7c3aed' },
  assignPillText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  assignPillTextGray: { color: '#374151' },
  assignPillTextGreen: { color: '#065f46' },
  assignPillTextPurple: { color: '#5b21b6' },
  emptyText: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
});
