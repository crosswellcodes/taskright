import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ActionSheetIOS } from 'react-native';

/**
 * Controlled assignee picker (CREATE_FLOW_ASSIGNMENT.md §5.1).
 *
 * `value` = { type: 'member' | 'group', id, name } | null.
 * `onChange(next)` fires with the resolved selection, or `null` when removed.
 * The parent decides what to do with it:
 *   - dispatch (ForecastDayScreen): immediate-write mode → onChange writes the API.
 *   - create (AssignCycleScreen): deferred mode → onChange holds it in local state.
 *
 * Presentation is identical in both: a tappable pill showing the current selection
 * + the existing iOS two-step ActionSheet (person/group[/remove] → pick).
 */
export default function AssigneePicker({
  teamMembers = [],
  teamGroups = [],
  value = null,
  onChange,
  allowRemove = true,
  disabled = false,
  placeholder = 'Assign',
  title = 'Assign',
  subject,           // optional name → "Choose a person for {subject}"
  style,
}) {
  const hasMembers = teamMembers.length > 0;
  const hasGroups = teamGroups.length > 0;
  const isGroup = value?.type === 'group';

  const openPicker = () => {
    if (!hasMembers && !hasGroups) return;

    // Step 1: Person or Group (or Remove)?
    const step1Options = ['Cancel'];
    if (hasMembers) step1Options.push('Assign a Person');
    if (hasGroups) step1Options.push('Assign a Group');
    if (allowRemove && value) step1Options.push('Remove Assignment');

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message: value
          ? `Currently: ${value.name} (${isGroup ? 'Group' : 'Person'})`
          : undefined,
        options: step1Options,
        cancelButtonIndex: 0,
        destructiveButtonIndex: (allowRemove && value) ? step1Options.length - 1 : undefined,
      },
      (step1Index) => {
        if (step1Index === 0) return; // Cancel
        const chosen = step1Options[step1Index];

        if (chosen === 'Remove Assignment') {
          onChange(null);
          return;
        }

        if (chosen === 'Assign a Person') {
          const memberOptions = ['Cancel', ...teamMembers.map(m => m.name)];
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: subject ? `Choose a person for ${subject}` : 'Choose a person',
              options: memberOptions,
              cancelButtonIndex: 0,
            },
            (step2Index) => {
              if (step2Index === 0) return;
              const member = teamMembers[step2Index - 1];
              onChange({ type: 'member', id: member.id, name: member.name });
            }
          );
          return;
        }

        if (chosen === 'Assign a Group') {
          const groupOptions = ['Cancel', ...teamGroups.map(g => g.name)];
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: subject ? `Choose a group for ${subject}` : 'Choose a group',
              options: groupOptions,
              cancelButtonIndex: 0,
            },
            (step2Index) => {
              if (step2Index === 0) return;
              const group = teamGroups[step2Index - 1];
              onChange({ type: 'group', id: group.id, name: group.name });
            }
          );
        }
      }
    );
  };

  return (
    <TouchableOpacity
      onPress={openPicker}
      disabled={disabled || (!hasMembers && !hasGroups)}
      style={[
        styles.pill,
        value ? (isGroup ? styles.pillPurple : styles.pillGreen) : styles.pillGray,
        style,
      ]}
    >
      {value && isGroup && <Text style={styles.icon}>●●</Text>}
      <Text
        style={[
          styles.text,
          value ? (isGroup ? styles.textPurple : styles.textGreen) : styles.textGray,
        ]}
        numberOfLines={1}
      >
        {value ? value.name : placeholder}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    maxWidth: 130,
  },
  pillGray: { backgroundColor: '#f3f4f6' },
  pillGreen: { backgroundColor: '#d1fae5' },
  pillPurple: { backgroundColor: '#ede9fe' },
  icon: { fontSize: 8, color: '#7c3aed' },
  text: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  textGray: { color: '#374151' },
  textGreen: { color: '#065f46' },
  textPurple: { color: '#5b21b6' },
});
