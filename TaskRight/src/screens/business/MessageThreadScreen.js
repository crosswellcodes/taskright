import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';

const API_BASE_URL = 'http://localhost:3000';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getCustomerMessages, sendCustomerMessage } from '../../api/businessApi';
import { formatPhone } from '../../utils/phoneUtils';

export default function MessageThreadScreen({ route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { customerId, customerName, customerPhone } = route.params;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await getCustomerMessages(user.businessId, customerId);
      setMessages(data.messages || []);
      setHasMore(data.pagination?.hasMore || false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [user.businessId, customerId]);

  useFocusEffect(
    useCallback(() => { loadMessages(); }, [loadMessages])
  );

  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [loading]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const data = await getCustomerMessages(user.businessId, customerId, { before: messages[0].id });
      setMessages(prev => [...(data.messages || []), ...prev]);
      setHasMore(data.pagination?.hasMore || false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load earlier messages');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    const body = draft.trim();
    setSending(true);
    try {
      const data = await sendCustomerMessage(user.businessId, customerId, body);
      setMessages(prev => [...prev, data.message]);
      setDraft('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (iso) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    );
  };

  const renderMessage = ({ item }) => {
    const isOut = item.direction === 'outbound';
    const hasMedia = Array.isArray(item.mediaUrls) && item.mediaUrls.length > 0;
    const hasText = item.body && item.body.trim().length > 0;
    return (
      <View style={[styles.bubbleRow, isOut ? styles.bubbleRowOut : styles.bubbleRowIn]}>
        <View style={[styles.bubble, isOut ? styles.bubbleOut : styles.bubbleIn]}>
          {hasText && (
            <Text style={[styles.bubbleText, isOut ? styles.bubbleTextOut : styles.bubbleTextIn]}>
              {item.body}
            </Text>
          )}
          {hasMedia && item.mediaUrls.map((url, idx) => (
            <Image
              key={idx}
              source={{ uri: API_BASE_URL + url }}
              style={[styles.messageImage, hasText && idx === 0 && styles.messageImageWithText]}
              resizeMode="cover"
            />
          ))}
          <Text style={[styles.bubbleTime, isOut ? styles.bubbleTimeOut : styles.bubbleTimeIn]}>
            {formatTimestamp(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={88}
    >
      <View style={styles.header}>
        <Text style={styles.headerName}>{customerName}</Text>
        {customerPhone ? (
          <Text style={styles.headerPhone}>{formatPhone(customerPhone)}</Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            hasMore ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <Text style={styles.loadMoreText}>Load earlier messages</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No messages yet.</Text>
              <Text style={styles.emptySubtext}>
                SMS notifications to this customer will appear here.
              </Text>
            </View>
          }
        />
      )}

      <View style={[styles.composeBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={1600}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendBtnText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerPhone: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  listContent: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },
  bubbleRow: { marginBottom: 8 },
  bubbleRowOut: { alignItems: 'flex-end' },
  bubbleRowIn: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOut: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleIn: { backgroundColor: '#e5e7eb', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextOut: { color: '#fff' },
  bubbleTextIn: { color: '#1a1a1a' },
  bubbleTime: { fontSize: 11, marginTop: 4 },
  bubbleTimeOut: { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },
  bubbleTimeIn: { color: '#9ca3af' },
  loadMoreBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  loadMoreText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 6 },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  composeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#93c5fd' },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: -2 },
  messageImage: { width: 220, height: 165, borderRadius: 10 },
  messageImageWithText: { marginTop: 8 },
});
