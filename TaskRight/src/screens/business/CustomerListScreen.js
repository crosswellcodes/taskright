import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Animated, PanResponder
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getCustomers, deleteCustomer } from '../../api/businessApi';
import { formatPhone } from '../../utils/phoneUtils';

const DELETE_BTN_WIDTH = 80;

function SwipeableRow({ children, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy),
      onPanResponderMove: (_, { dx }) => {
        // Allow swipe left only
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

export default function CustomerListScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await getCustomers(user.businessId);
      setCustomers(data.customers || []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.businessId]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchCustomers);
    return unsubscribe;
  }, [navigation, fetchCustomers]);

  const handleDelete = async (customerId) => {
    try {
      await deleteCustomer(user.businessId, customerId);
      setCustomers(prev => prev.filter(c => c.id !== customerId));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to delete customer');
      fetchCustomers();
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={customers}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCustomers(); }} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 + insets.bottom }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No customers yet. Add one below.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableRow onDelete={() => handleDelete(item.id)}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id, customerName: item.name })}
              activeOpacity={0.7}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{formatPhone(item.phoneNumber)}</Text>
              </View>
              <View style={styles.cardRight}>
                <View style={styles.cyclesBadge}>
                  <Text style={styles.cyclesText}>{item.assignedCycles?.length || 0} cycle{item.assignedCycles?.length !== 1 ? 's' : ''}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </SwipeableRow>
        )}
      />
      <View style={[styles.fab, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.fabBtn} onPress={() => navigation.navigate('AddCustomer')}>
          <Text style={styles.fabText}>+ Add Customer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#888' },
  swipeContainer: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BTN_WIDTH,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionBtn: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  phone: { fontSize: 14, color: '#888' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cyclesBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  cyclesText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  fab: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  fabBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
