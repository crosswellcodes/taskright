import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Dimensions,
  TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { updateFeedbackBusinessNotes } from '../../api/businessApi';

const BASE_URL = 'http://localhost:3000';
const COLUMN_COUNT = 2;
const GAP = 12;
const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 32 - GAP) / COLUMN_COUNT;

export default function CustomerFeedbackDetailScreen({ route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { feedback } = route.params;

  const [businessNotes, setBusinessNotes] = useState(feedback.businessNotes || null);
  const [modalVisible, setModalVisible] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const serviceDate = new Date(feedback.serviceDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const photos = feedback.photoFilenames || [];

  const handleOpenModal = () => {
    setDraftNotes(businessNotes || '');
    setModalVisible(true);
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const trimmed = draftNotes.trim() || null;
      await updateFeedbackBusinessNotes(user.businessId, feedback.id, trimmed);
      setBusinessNotes(trimmed);
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        {/* Date + Log Note button */}
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{serviceDate}</Text>
          <TouchableOpacity style={styles.noteBtn} onPress={handleOpenModal}>
            <Text style={styles.noteBtnText}>
              {businessNotes ? 'Edit Note' : '+ Log a Note'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Business private notes card */}
        {businessNotes ? (
          <TouchableOpacity
            style={[styles.card, styles.notesCard]}
            onPress={handleOpenModal}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, styles.notesTitleColor]}>Your Notes</Text>
              <View style={styles.privateTag}>
                <Text style={styles.privateTagText}>Private</Text>
              </View>
            </View>
            <Text style={styles.feedbackText}>{businessNotes}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Customer comments */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comments</Text>
          {feedback.feedbackText ? (
            <Text style={styles.feedbackText}>{feedback.feedbackText}</Text>
          ) : (
            <Text style={styles.emptyText}>No comments submitted</Text>
          )}
        </View>

        {/* Photos */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Photos{photos.length > 0 ? ` (${photos.length})` : ''}
          </Text>
          {photos.length === 0 ? (
            <Text style={styles.emptyText}>No photos attached</Text>
          ) : (
            <View style={styles.photoGrid}>
              {photos.map((filename, idx) => (
                <Image
                  key={idx}
                  source={{ uri: `${BASE_URL}/uploads/feedback/${filename}` }}
                  style={[styles.photo, { width: PHOTO_SIZE, height: PHOTO_SIZE }]}
                  resizeMode="cover"
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Notes modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Private Notes</Text>
              <Text style={styles.modalSub}>Only visible to you — not shared with the customer</Text>
            </View>

            <TextInput
              style={styles.notesInput}
              value={draftNotes}
              onChangeText={setDraftNotes}
              placeholder="e.g. Customer mentioned wanting more attention to the kitchen next time..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveNotes}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Save Note</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // Date row
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  dateLabel: { fontSize: 14, color: '#888', fontWeight: '500', flex: 1 },
  noteBtn: {
    backgroundColor: '#eff6ff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  noteBtnText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
  },
  notesCard: {
    borderWidth: 1.5, borderColor: '#e0f2fe', backgroundColor: '#f0f9ff',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  cardTitle: {
    fontSize: 13, fontWeight: '600', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  notesTitleColor: { color: '#0369a1' },
  privateTag: {
    backgroundColor: '#dbeafe', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  privateTagText: { fontSize: 11, color: '#1d4ed8', fontWeight: '600' },
  feedbackText: { fontSize: 16, color: '#1a1a1a', lineHeight: 24 },
  emptyText: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  photo: { borderRadius: 8, backgroundColor: '#f3f4f6' },

  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 24, paddingHorizontal: 20,
  },
  modalHeader: { marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#888' },
  notesInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#1a1a1a',
    minHeight: 130, backgroundColor: '#fafafa', marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  saveBtnDisabled: { backgroundColor: '#93c5fd' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: '#2563eb', fontSize: 15 },
});
