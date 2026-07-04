import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, Alert, TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getSelectionHistory } from '../../api/customerApi';

export default function HistoryScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSelectionHistory(user.customerId);
        setHistory(data.history || []);
      } catch (err) {
        Alert.alert('Error', err.message || 'Failed to load history');
      } finally {
        setLoading(false);
      }
    })();
  }, [user.customerId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (history.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No service history yet.</Text>
      </View>
    );
  }

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const renderItem = ({ item }) => {
    const isExpanded = expandedId === item.selectionCycleId;
    const isCompleted = item.status === 'completed';

    const date = new Date(item.serviceDate).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });

    const hasTasksSelected = item.selectedTaskNames && item.selectedTaskNames.length > 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => toggleExpand(item.selectionCycleId)}
        activeOpacity={0.85}
      >
        {/* Card header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardDate}>{date}</Text>
            <Text style={styles.cardRef}>Ref #{item.selectionCycleId}</Text>
          </View>
          <View style={[styles.badge, isCompleted ? styles.badgeCompleted : styles.badgeOpen]}>
            <Text style={[styles.badgeText, isCompleted ? styles.badgeTextCompleted : styles.badgeTextOpen]}>
              {isCompleted ? 'Completed' : 'Upcoming'}
            </Text>
          </View>
        </View>

        {/* Feedback badge for completed services */}
        {isCompleted && (
          <View style={styles.feedbackRow}>
            {item.hasFeedback ? (
              <View style={styles.feedbackBadge}>
                <Text style={styles.feedbackBadgeText}>✓ Feedback submitted</Text>
              </View>
            ) : (
              <View style={styles.noFeedbackBadge}>
                <Text style={styles.noFeedbackBadgeText}>No feedback submitted</Text>
              </View>
            )}
          </View>
        )}

        {/* Summary line */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {hasTasksSelected
              ? `${item.selectedTaskNames.length} task${item.selectedTaskNames.length !== 1 ? 's' : ''} selected`
              : 'No tasks selected'}
          </Text>
          {item.selectedTotalHours != null && (
            <Text style={styles.summaryHours}>{item.selectedTotalHours} hr{item.selectedTotalHours !== 1 ? 's' : ''}</Text>
          )}
        </View>

        {/* Expand chevron */}
        {hasTasksSelected && (
          <Text style={styles.chevron}>{isExpanded ? '▲ Hide tasks' : '▼ Show tasks'}</Text>
        )}

        {/* Expanded task list */}
        {isExpanded && hasTasksSelected && (
          <View style={styles.taskList}>
            {item.selectedTaskNames.map((task, idx) => (
              <View key={idx} style={styles.taskRow}>
                <Text style={styles.taskName}>{task.name}</Text>
                <Text style={styles.taskTime}>{task.minutes} min</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      data={history}
      keyExtractor={(item) => String(item.selectionCycleId)}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#888' },

  card: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  cardHeaderLeft: { flex: 1, marginRight: 8 },
  cardDate: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  cardRef: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeCompleted: { backgroundColor: '#d1fae5' },
  badgeOpen: { backgroundColor: '#dbeafe' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextCompleted: { color: '#065f46' },
  badgeTextOpen: { color: '#1e40af' },

  feedbackRow: { marginBottom: 8 },
  feedbackBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  feedbackBadgeText: { fontSize: 12, color: '#16a34a', fontWeight: '500' },
  noFeedbackBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  noFeedbackBadgeText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  summaryText: { fontSize: 14, color: '#6b7280' },
  summaryHours: { fontSize: 14, color: '#6b7280', fontWeight: '500' },

  chevron: { fontSize: 12, color: '#2563eb', marginTop: 8, fontWeight: '500' },

  taskList: {
    marginTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10,
  },
  taskRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 5,
  },
  taskName: { fontSize: 14, color: '#374151', flex: 1, marginRight: 12 },
  taskTime: { fontSize: 13, color: '#9ca3af' },
});
