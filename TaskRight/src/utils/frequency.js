// Short display labels for a Service/Template frequency. Keeps the stored value
// (`one_time`, `weekly`, …) out of the UI. The Service builder uses its own
// descriptive picker labels; these are the compact labels for cards/rows.
const FREQUENCY_LABELS = {
  one_time: 'One-time',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export function frequencyLabel(value) {
  return FREQUENCY_LABELS[value] || value;
}
