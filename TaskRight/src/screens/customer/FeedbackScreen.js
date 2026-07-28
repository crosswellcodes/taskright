import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  Image, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { submitFeedback, getFeedbackForCycle } from '../../api/customerApi';

const MAX_PHOTOS = 5;
const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function FeedbackScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { customerId, selectionCycleId, serviceDate } = route.params;

  const [rating, setRating] = useState(0); // 0 = unrated (optional)
  const [feedbackText, setFeedbackText] = useState('');
  const [photos, setPhotos] = useState([]); // { uri, type, name } — new picks
  const [existingPhotos, setExistingPhotos] = useState([]); // filenames from server
  const [removedExisting, setRemovedExisting] = useState([]); // filenames to drop
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const formattedDate = new Date(serviceDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  // Load existing feedback if any
  const loadExisting = useCallback(async () => {
    try {
      const data = await getFeedbackForCycle(customerId, selectionCycleId);
      if (data.feedback) {
        setRating(data.feedback.rating || 0);
        setFeedbackText(data.feedback.feedbackText || '');
        setExistingPhotos(data.feedback.photoFilenames || []);
      }
    } catch {
      // No feedback yet — that's fine
    } finally {
      setLoading(false);
    }
  }, [customerId, selectionCycleId]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  const handleAddPhoto = async () => {
    const totalPhotos = (existingPhotos.length - removedExisting.length) + photos.length;
    if (totalPhotos >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: MAX_PHOTOS - totalPhotos,
      });
      if (result.didCancel || result.errorCode) return;
      const picked = (result.assets || []).map(asset => ({
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `photo_${Date.now()}.jpg`,
      }));
      setPhotos(prev => [...prev, ...picked].slice(0, MAX_PHOTOS));
    } catch (err) {
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const handleRemoveNew = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExisting = (filename) => {
    setRemovedExisting(prev => [...prev, filename]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('selectionCycleId', String(selectionCycleId));
      if (rating > 0) {
        formData.append('rating', String(rating));
      }
      if (feedbackText.trim()) {
        formData.append('feedbackText', feedbackText.trim());
      }
      photos.forEach(photo => {
        formData.append('photos', {
          uri: photo.uri,
          type: photo.type,
          name: photo.name,
        });
      });
      await submitFeedback(customerId, formData);
      Alert.alert('Thank you!', 'Your feedback has been submitted.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  const activeExisting = existingPhotos.filter(f => !removedExisting.includes(f));
  const totalCount = activeExisting.length + photos.length;
  const canAddMore = totalCount < MAX_PHOTOS;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header card */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Leave Feedback</Text>
          <Text style={styles.headerDate}>{formattedDate}</Text>
        </View>

        {/* Star rating */}
        <View style={styles.section}>
          <Text style={styles.label}>Rate your service (optional)</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setRating(prev => (prev === n ? 0 : n))}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityLabel={`${n} star${n !== 1 ? 's' : ''}`}
              >
                <Text style={[styles.star, n <= rating ? styles.starOn : styles.starOff]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 ? (
            <Text style={styles.ratingLabel}>{RATING_LABELS[rating - 1]}</Text>
          ) : (
            <Text style={styles.ratingHint}>Tap a star to rate — or skip it.</Text>
          )}
        </View>

        {/* Feedback text */}
        <View style={styles.section}>
          <Text style={styles.label}>How was your service? (optional)</Text>
          <TextInput
            style={styles.textArea}
            value={feedbackText}
            onChangeText={setFeedbackText}
            placeholder="Share your experience..."
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.label}>Photos ({totalCount}/{MAX_PHOTOS})</Text>
          <View style={styles.photoGrid}>

            {/* Existing server photos */}
            {activeExisting.map((filename) => (
              <View key={filename} style={styles.photoSlot}>
                <View style={styles.existingPhotoBox}>
                  <Text style={styles.existingPhotoIcon}>🖼</Text>
                  <Text style={styles.existingPhotoText} numberOfLines={1}>{filename.slice(0, 12)}…</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemoveExisting(filename)}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Newly picked photos */}
            {photos.map((photo, index) => (
              <View key={photo.uri} style={styles.photoSlot}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemoveNew(index)}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Add button */}
            {canAddMore && (
              <TouchableOpacity style={styles.addSlot} onPress={handleAddPhoto}>
                <Text style={styles.addSlotPlus}>+</Text>
                <Text style={styles.addSlotLabel}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.photoHint}>Tap a photo to remove it. Up to {MAX_PHOTOS} photos.</Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Submit Feedback</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: {
    backgroundColor: '#2563eb', borderRadius: 12,
    padding: 16, marginBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerDate: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  section: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginBottom: 16,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 10 },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 38, lineHeight: 44 },
  starOn: { color: '#f59e0b' },
  starOff: { color: '#d1d5db' },
  ratingLabel: { fontSize: 14, color: '#b45309', fontWeight: '600', marginTop: 8 },
  ratingHint: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  textArea: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa',
    minHeight: 120, textAlignVertical: 'top',
  },
  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  photoSlot: { position: 'relative' },
  photoThumb: {
    width: 80, height: 80, borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  existingPhotoBox: {
    width: 80, height: 80, borderRadius: 8,
    backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center',
    padding: 4,
  },
  existingPhotoIcon: { fontSize: 24 },
  existingPhotoText: { fontSize: 9, color: '#555', marginTop: 2, textAlign: 'center' },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#ef4444', borderRadius: 10,
    width: 20, height: 20, justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addSlot: {
    width: 80, height: 80, borderRadius: 8,
    borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  addSlotPlus: { fontSize: 24, color: '#9ca3af', lineHeight: 28 },
  addSlotLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  photoHint: { fontSize: 12, color: '#9ca3af', marginTop: 10 },
  submitBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  submitBtnDisabled: { backgroundColor: '#93c5fd' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: '#2563eb', fontSize: 15 },
});
