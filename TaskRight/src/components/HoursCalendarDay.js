import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Shared custom calendar day cell: the date number plus the hours already booked
// that day, so an owner can gauge daily load at a glance. Used by both the create
// flow (AssignCycleScreen) and the Dashboard calendar. The hours figure is tinted
// by the day's submission-status colour, which callers pass as `marking.dotColor`.
//
// Props are the standard react-native-calendars dayComponent props
// ({ date, state, marking }) plus:
//   hoursByDate — { 'YYYY-MM-DD': number } map of booked hours per date
//   colorByDate — optional { 'YYYY-MM-DD': colour } map; when a date has an entry
//                 its circle is filled with that colour (e.g. submission-status
//                 colour on the Dashboard). Falls back to the selected-day fill.
//   onDayPress  — (date) => void, called with the day object on tap

function fmtHours(h) {
  return h % 1 === 0 ? String(h) : h.toFixed(1);
}

export default function HoursCalendarDay({ date, state, marking, onDayPress, hoursByDate, colorByDate }) {
  const key = date?.dateString;
  const hours = (hoursByDate && key && hoursByDate[key]) || 0;
  const disabled = state === 'disabled';
  const isToday = state === 'today';
  const selected = !!marking?.selected;
  // Explicit per-date colour (Dashboard) wins; otherwise fill only the selected day.
  const fillColor = (colorByDate && key && colorByDate[key])
    || (selected ? (marking?.selectedColor || '#2563eb') : null);
  const filled = !!fillColor;
  const loadColor = marking?.dotColor || fillColor || '#2563eb';
  return (
    <TouchableOpacity
      style={styles.dayCell}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => onDayPress && onDayPress(date)}
    >
      <View style={[styles.dayCircle, filled && { backgroundColor: fillColor }]}>
        <Text style={[
          styles.dayNum,
          disabled && styles.dayNumDisabled,
          isToday && !filled && styles.dayNumToday,
          filled && styles.dayNumSelected,
        ]}>
          {date?.day}
        </Text>
      </View>
      {hours > 0
        ? <Text style={[styles.dayHours, { color: loadColor }]}>{fmtHours(hours)}h</Text>
        : <Text style={styles.dayHoursEmpty}> </Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dayCell: { alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 2, minHeight: 46 },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  dayNumDisabled: { color: '#d1d5db' },
  dayNumToday: { color: '#2563eb', fontWeight: '700' },
  dayNumSelected: { color: '#fff', fontWeight: '700' },
  dayHours: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  dayHoursEmpty: { fontSize: 10, marginTop: 1 },
});
