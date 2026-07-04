import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { MAPBOX_ACCESS_TOKEN } from '../config';

export default function MapboxAddressInput({ value, onChangeText, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const encoded = encodeURIComponent(query);
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
        `?access_token=${MAPBOX_ACCESS_TOKEN}&autocomplete=true&types=address&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text) => {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 350);
  };

  const handleSelect = (placeName) => {
    onChangeText(placeName);
    setSuggestions([]);
  };

  const handleBlur = () => {
    // Short delay so a tap on a suggestion registers before dismissing
    setTimeout(() => setSuggestions([]), 150);
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputRow, suggestions.length > 0 && styles.inputRowOpen]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          placeholder={placeholder || 'Start typing an address...'}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {loading && (
          <ActivityIndicator style={styles.spinner} size="small" color="#2563eb" />
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((feature, index) => (
            <TouchableOpacity
              key={feature.id}
              style={[
                styles.suggestion,
                index === suggestions.length - 1 && styles.suggestionLast,
              ]}
              onPress={() => handleSelect(feature.place_name)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionPrimary} numberOfLines={1}>
                {feature.text}
              </Text>
              <Text style={styles.suggestionSecondary} numberOfLines={1}>
                {feature.place_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { zIndex: 100 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    backgroundColor: '#fafafa', paddingHorizontal: 14,
  },
  inputRowOpen: {
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    borderBottomColor: '#e5e7eb',
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1a1a1a' },
  spinner: { marginLeft: 8 },
  dropdown: {
    borderWidth: 1, borderTopWidth: 0, borderColor: '#ddd',
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  suggestion: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  suggestionLast: { borderBottomWidth: 0 },
  suggestionPrimary: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  suggestionSecondary: { fontSize: 12, color: '#888' },
});
