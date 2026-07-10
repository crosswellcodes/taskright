import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Animated, PanResponder,
  ActionSheetIOS, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  getTeamMembers, deleteTeamMember,
  getTeamGroups, deleteTeamGroup,
} from '../../api/businessApi';
import { formatPhone } from '../../utils/phoneUtils';

const DELETE_BTN_WIDTH = 80;

// ─── Swipeable row (shared by Members + Groups tabs) ─────────────────────────

function SwipeableRow({ children, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy),
      onPanResponderMove: (_, { dx }) => {
        translateX.setValue(Math.max(-DELETE_BTN_WIDTH, Math.min(0, dx)));
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -DELETE_BTN_WIDTH / 2) {
          Animated.spring(translateX, { toValue: -DELETE_BTN_WIDTH, useNativeDriver: true }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Animated.timing(translateX, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => onDelete());
  };

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.deleteAction}>
        <TouchableOpacity style={styles.deleteActionBtn} onPress={handleDelete} activeOpacity={0.8}>
          <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

// ─── Members tab ─────────────────────────────────────────────────────────────

function MembersTab({ navigation, refreshSignal }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await getTeamMembers(user.businessId);
      setMembers(data.teamMembers || []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.businessId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers, refreshSignal]);

  const handleDelete = async (memberId) => {
    try {
      await deleteTeamMember(user.businessId, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to delete team member');
      fetchMembers();
    }
  };

  const handleContact = (member) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: member.name,
        message: formatPhone(member.phoneNumber),
        options: ['Cancel', 'Call', 'Text'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) Linking.openURL(`tel:${member.phoneNumber}`);
        if (buttonIndex === 2) Linking.openURL(`sms:${member.phoneNumber}`);
      }
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <FlatList
      data={members}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMembers(); }} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No team members yet. Add one below.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <SwipeableRow onDelete={() => handleDelete(item.id)}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('EditTeamMember', { member: item })}
          >
            <View style={styles.cardLeft}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => handleContact(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.contactBtnText}>Call or Text</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.phone}>{formatPhone(item.phoneNumber)}</Text>
              {item.groups && item.groups.length > 0 && (
                <Text style={styles.memberGroups} numberOfLines={2}>
                  {item.groups.map(g => g.name).join(' · ')}
                </Text>
              )}
            </View>
            <View style={styles.hoursBadge}>
              <Text style={styles.hoursText}>{item.weeklyHours} hrs/week</Text>
              {item.hourlyRate != null && (
                <Text style={styles.rateText}>${item.hourlyRate}/hr</Text>
              )}
            </View>
          </TouchableOpacity>
        </SwipeableRow>
      )}
    />
  );
}

// ─── Groups tab ──────────────────────────────────────────────────────────────

function GroupsTab({ navigation, refreshSignal }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await getTeamGroups(user.businessId);
      setGroups(data.groups || []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.businessId]);

  useEffect(() => { fetchGroups(); }, [fetchGroups, refreshSignal]);

  const handleDelete = async (groupId) => {
    Alert.alert(
      'Delete Group',
      'This will delete the group but not remove its members from your roster.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteTeamGroup(user.businessId, groupId);
              setGroups(prev => prev.filter(g => g.id !== groupId));
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete group');
              fetchGroups();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchGroups(); }} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No groups yet. Create one below.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <SwipeableRow onDelete={() => handleDelete(item.id)}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('TeamGroupForm', { group: item })}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.phone} numberOfLines={2}>
                {item.members && item.members.length > 0
                  ? item.members.map(m => m.name).join(', ')
                  : 'No members yet'}
              </Text>
            </View>
            <View style={styles.hoursBadge}>
              <Text style={styles.hoursText}>Edit →</Text>
            </View>
          </TouchableOpacity>
        </SwipeableRow>
      )}
    />
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TeamScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('members');
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Refresh data when screen comes back into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setRefreshSignal(n => n + 1);
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Segmented control */}
      <View style={styles.segmentWrapper}>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'members' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('members')}
          >
            <Text style={[styles.segmentText, activeTab === 'members' && styles.segmentTextActive]}>
              Members
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'groups' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('groups')}
          >
            <Text style={[styles.segmentText, activeTab === 'groups' && styles.segmentTextActive]}>
              Groups
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab content */}
      {activeTab === 'members' && (
        <MembersTab navigation={navigation} refreshSignal={refreshSignal} />
      )}
      {activeTab === 'groups' && (
        <GroupsTab navigation={navigation} refreshSignal={refreshSignal} />
      )}

      {/* Context-aware FAB */}
      <View style={[styles.fab, { paddingBottom: insets.bottom + 12 }]}>
        {activeTab === 'members' ? (
          <TouchableOpacity style={styles.fabBtn} onPress={() => navigation.navigate('AddTeamMember')}>
            <Text style={styles.fabText}>+ Add Team Member</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.fabBtn} onPress={() => navigation.navigate('TeamGroupForm', { group: null })}>
            <Text style={styles.fabText}>+ Create Group</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#888' },

  // Segmented control
  segmentWrapper: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  segment: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 10, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#888' },
  segmentTextActive: { color: '#2563eb' },

  // Swipeable
  swipeContainer: { marginBottom: 10, borderRadius: 12, overflow: 'hidden' },
  deleteAction: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: DELETE_BTN_WIDTH, backgroundColor: '#ef4444',
    justifyContent: 'center', alignItems: 'center',
  },
  deleteActionBtn: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  deleteActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  contactBtn: {
    backgroundColor: '#eff6ff', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  contactBtnText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  phone: { fontSize: 14, color: '#888' },
  memberGroups: { fontSize: 12, color: '#2563eb', marginTop: 4 },
  hoursBadge: {
    backgroundColor: '#eff6ff', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20,
  },
  hoursText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  rateText: { fontSize: 12, color: '#059669', fontWeight: '600', marginTop: 2 },

  // FAB
  fab: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingTop: 12, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  fabBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
