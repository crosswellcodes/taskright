import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { getMyJobs } from '../../api/teamMemberApi';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const dateOnly = String(dateStr).split('T')[0];
  const d = new Date(dateOnly + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isToday(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  const dateOnly = String(dateStr).split('T')[0];
  return dateOnly === today;
}

export default function MyJobsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await getMyJobs(user.teamMemberId);
      setJobs(data.jobs || []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.teamMemberId]);

  useFocusEffect(
    useCallback(() => { fetchJobs(); }, [fetchJobs])
  );

  const todayJobs = jobs.filter(j => isToday(j.serviceDate));
  const upcomingJobs = jobs.filter(j => !isToday(j.serviceDate));

  const renderJob = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('JobDetail', {
        selectionCycleId: item.selectionCycleId,
        customerName: item.customerName,
        serviceDate: item.serviceDate,
        serviceCycleName: item.serviceCycleName,
        customerAddress: item.customerAddress || null,
      })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <View style={[styles.badge, item.status === 'open' ? styles.badgeOpen : styles.badgeDone]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.cycleRow}>
        <Text style={styles.cycleName}>{item.serviceCycleName}</Text>
        {item.isTeamAssigned ? (
          <View style={styles.teamBadge}>
            <Text style={styles.teamBadgeText}>{item.teamName ? `Team · ${item.teamName}` : 'Team'}</Text>
          </View>
        ) : null}
      </View>
      {item.customerAddress ? (
        <TouchableOpacity
          style={styles.addressRow}
          onPress={() => {
            const encoded = encodeURIComponent(item.customerAddress);
            Linking.openURL(`maps://?daddr=${encoded}`);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.addressText} numberOfLines={1}>{item.customerAddress}</Text>
          <Text style={styles.directionsLink}>Directions →</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.cardBottom}>
        <Text style={styles.dateText}>{formatDate(item.serviceDate)}</Text>
        {item.selectedTasks && item.selectedTasks.length > 0 ? (
          <Text style={styles.taskCount}>{item.selectedTasks.length} task{item.selectedTasks.length !== 1 ? 's' : ''}</Text>
        ) : (
          <Text style={styles.taskCountPending}>Awaiting selection</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'there'}</Text>
          <Text style={styles.headerSub}>Your upcoming jobs</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => 'dummy'}
        renderItem={null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} />
        }
        ListHeaderComponent={
          <>
            {/* Today */}
            {todayJobs.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Today</Text>
                {todayJobs.map(item => (
                  <View key={item.selectionCycleId}>
                    {renderJob({ item })}
                  </View>
                ))}
              </>
            )}

            {/* Upcoming */}
            {upcomingJobs.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Upcoming</Text>
                {upcomingJobs.map(item => (
                  <View key={item.selectionCycleId}>
                    {renderJob({ item })}
                  </View>
                ))}
              </>
            )}

            {/* Empty */}
            {jobs.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No jobs assigned yet</Text>
                <Text style={styles.emptySub}>
                  Your business owner will assign jobs to you. Check back soon.
                </Text>
              </View>
            )}
          </>
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 16,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: '#bfdbfe', marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  list: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  cycleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cycleName: { fontSize: 13, color: '#888', flexShrink: 1 },
  teamBadge: { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  teamBadgeText: { fontSize: 11, fontWeight: '600', color: '#6d28d9' },
  addressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addressText: { fontSize: 13, color: '#555', flex: 1, marginRight: 8 },
  directionsLink: { fontSize: 13, color: '#2563eb', fontWeight: '600', flexShrink: 0 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 14, color: '#555', fontWeight: '500' },
  taskCount: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  taskCountPending: { fontSize: 13, color: '#f59e0b', fontWeight: '500' },

  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
  badgeOpen: { backgroundColor: '#dbeafe' },
  badgeDone: { backgroundColor: '#d1fae5' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#1e40af' },

  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});
