# TaskRight Design System

## Color Palette

### Primary Colors
| Name | Hex | Usage | Notes |
|------|-----|-------|-------|
| **Primary Blue** | `#2563eb` | Main actions, headers, cards, badges | Bright, energetic, trustworthy |
| **Success Green** | `#10b981` | Confirmations, checkmarks, submitted states | Success feedback, positive actions |
| **Danger Red** | `#dc2626` | Error states, destructive actions | Not heavily used currently |

### Neutral Colors
| Name | Hex | Usage | Notes |
|------|-----|-------|-------|
| **Dark Text** | `#1a1a1a` | Primary text, headings | High contrast, readable |
| **Medium Text** | `#374151` | Secondary text, labels | Medium emphasis |
| **Light Text** | `#6b7280` | Tertiary text, hints | Low emphasis, subtle |
| **Lighter Text** | `#888` | Muted text, timestamps | Further reduced emphasis |
| **Light Background** | `#f5f5f5` | Main app background | Subtle, non-intrusive |
| **White Surface** | `#fff` | Cards, modals, sections | High contrast surfaces |
| **Light Blue BG** | `#f0f4ff` | Section backgrounds (staff info) | Subtle, branded |

### Semantic Colors
| Name | Hex | Usage | Notes |
|------|-----|-------|-------|
| **Blue Overlay** | `rgba(37, 99, 235, 0.1)` | Pill backgrounds on light | Light branded tint |
| **White Overlay** | `rgba(255, 255, 255, 0.2)` | Pill backgrounds on blue | Frosted glass effect |
| **Green Light** | `#d1fae5` | Green badge background | Soft success highlight |
| **Green Dark** | `#065f46` | Green badge text | High contrast on light green |
| **Amber Light** | `#fef3c7` | Amber badge background | Pending/warning state |
| **Amber Dark** | `#92400e` | Amber badge text | High contrast on amber |

---

## Typography

### Font Family
- **Primary**: System default (uses device's native font)
  - iOS: San Francisco
  - Android: Roboto

### Font Sizes & Weights

#### Headings
| Level | Size | Weight | Usage | Example |
|-------|------|--------|-------|---------|
| **H1** | 28px | 700 | Page title (SuccessScreen) | "Selection Submitted!" |
| **H2** | 22px | 700 | Major section title | "Hi, {name}" (greeting) |
| **H3** | 20px | 700 | Modal title | "Service Tasks", "Your Selections" |
| **H4** | 16px | 700 | Card titles, strong labels | — |

#### Body Text
| Size | Weight | Usage | Example |
|------|--------|-------|---------|
| **15-16px** | 600 | Strong body, labels, button text | Business name, task names |
| **14-15px** | 400-500 | Regular body text | Descriptions, info text |
| **13-14px** | 400-500 | Small body text | Secondary info, time allotments |
| **12-13px** | 400-500 | Extra small text | Hints, subtitles, chips |
| **11px** | 700 | Section headings, badges | "WHO'S COMING", badge text |

#### Line Heights
- **Headings**: 1.2 (tight)
- **Body**: 1.5 (comfortable)
- **Multiline labels**: 24px (specific)

---

## Component Styles

### Buttons

#### Primary Button
```javascript
{
  backgroundColor: '#2563eb',
  borderRadius: 10,
  paddingVertical: 14,
  paddingHorizontal: 16,
  alignItems: 'center'
}
```
- **Text**: 16px, weight 600, color white
- **Usage**: Main call-to-action (Select Tasks, Confirm & Submit)

#### Secondary Button (Outlined)
```javascript
{
  backgroundColor: '#fff',
  borderWidth: 1.5,
  borderColor: '#2563eb',
  borderRadius: 10,
  paddingVertical: 14,
  paddingHorizontal: 16,
  alignItems: 'center'
}
```
- **Text**: 15px, weight 600, color `#2563eb`
- **Usage**: Secondary actions (View Upcoming Services, View History)

### Cards

#### Blue Card (Next Service)
```javascript
{
  backgroundColor: '#2563eb',
  borderRadius: 14,
  padding: 20,
  marginHorizontal: 16,
  marginVertical: 8
}
```
- **Purpose**: Highlight upcoming service
- **Content**: 2-column layout (left: date/hours, right: staff pills)
- **Status Badge**: Green pill with checkmark when submitted

#### White Card (Task Summary)
```javascript
{
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 16,
  marginHorizontal: 16,
  marginBottom: 16
}
```
- **Purpose**: Display available tasks preview
- **Shows**: First 3 tasks + "+ more" hint

### Badges & Pills

#### Status Badge (Pill)
```javascript
// Green - Submitted
{
  backgroundColor: 'rgba(134, 239, 172, 0.25)',
  borderRadius: 10,
  paddingVertical: 2,
  paddingHorizontal: 8,
  borderWidth: 1,
  borderColor: 'rgba(134, 239, 172, 0.4)'
}
// Text: '#86efac', fontSize: 11, fontWeight: '700'
```

#### Staff Pills (Card)
```javascript
{
  backgroundColor: 'rgba(255, 255, 255, 0.2)',  // White semi-transparent on blue
  borderRadius: 20,
  paddingVertical: 4,
  paddingHorizontal: 10,
  marginBottom: 5
}
// Text: white, fontSize: 12, fontWeight: '600'
```

#### Staff Pills (Modal)
```javascript
{
  backgroundColor: 'rgba(37, 99, 235, 0.1)',    // Blue semi-transparent on light
  borderRadius: 20,
  paddingVertical: 4,
  paddingHorizontal: 10,
  borderWidth: 1,
  borderColor: 'rgba(37, 99, 235, 0.25)'
}
// Text: '#1d4ed8', fontSize: 13, fontWeight: '600'
```

#### Action Badges (Upcoming Services)
```javascript
// Green - "✓ Tasks Selected"
{
  backgroundColor: '#d1fae5',
  borderRadius: 10,
  paddingVertical: 3,
  paddingHorizontal: 8
}
// Text: '#065f46', fontSize: 12, fontWeight: '600'

// Amber - "Select Tasks →"
{
  backgroundColor: '#fef3c7',
  borderRadius: 10,
  paddingVertical: 3,
  paddingHorizontal: 8
}
// Text: '#92400e', fontSize: 12, fontWeight: '600'
```

### Modals

#### Modal Container
```javascript
{
  flex: 1,
  backgroundColor: '#fff'
}
```

#### Modal Header
```javascript
{
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingTop: 20,
  paddingBottom: 4
}
```

#### Modal Section (Info Box)
```javascript
{
  marginHorizontal: 20,
  marginBottom: 8,
  paddingVertical: 12,
  paddingHorizontal: 14,
  backgroundColor: '#f0f4ff',
  borderRadius: 10
}
```
- **Usage**: Staff info, business name display
- **Note**: Light blue tint for subtle branding

### Lists & Rows

#### Task Row
```javascript
{
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: '#f0f0f0'
}
```

#### Task Row (Selected)
```javascript
{
  backgroundColor: '#f0fdf4',
  borderRadius: 8,
  paddingHorizontal: 8,
  marginBottom: 2,
  borderBottomWidth: 0
}
```
- **Checkmark**: Green circle, white checkmark
- **Text**: Green (#15803d), weight 600

---

## Spacing System

### Padding (Content internal spacing)
- **Small**: 4px, 8px (tight, within components)
- **Medium**: 12px, 14px, 16px (default content padding)
- **Large**: 20px (card padding, large sections)
- **Extra Large**: 32px (screen edge padding, safe areas)

### Margins (Space between elements)
- **Small**: 4px, 8px
- **Medium**: 12px, 16px (default vertical spacing)
- **Large**: 20px, 24px (section spacing)

### Gaps (Flex gap in rows/columns)
- **Small**: 4px, 6px (item spacing in pills)
- **Medium**: 8px, 10px (default item spacing)

---

## Shadows & Elevation

Currently minimal shadows; clean, flat design:
- Modal borders: 1-1.5px
- No drop shadows on cards
- Light borders for separation

---

## Icons

### Emoji Usage
✅ **Working**:
- ✓ (checkmark)
- 👤 (person)
- ⬅ (back arrow)

❌ **Avoid**:
- 📅 (calendar) — renders as placeholder on some devices

---

## Responsive Behavior

### Safe Areas
- Uses `useSafeAreaInsets()` for notch/home indicator awareness
- Padding applied to ScrollView contentContainerStyle

### Orientation
- Portrait-only (mobile app)
- No landscape layout support currently

---

## Component Library Reference

### Reusable Components
- **Blue Card**: `TaskRight/src/screens/customer/CurrentSelectionScreen.js` (lines 144-176)
- **Pills**: `TaskRight/src/screens/customer/CurrentSelectionScreen.js` (staff pills on card + modal)
- **Modal**: `TaskRight/src/screens/customer/CurrentSelectionScreen.js` (pageSheet presentation)
- **Task Row**: Multiple screens (TaskPickerScreen, ConfirmationScreen, HistoryScreen)
- **Status Badges**: CurrentSelectionScreen.js, upcoming services modal

---

## Web Design System Notes

For the website, mirror this system with these adaptations:
- **Typography**: Use web-safe fonts (e.g., -apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
- **Spacing**: Scale from REM units (1rem ≈ 16px as default)
- **Buttons**: Use similar structure but with hover states for mouse interaction
- **Cards**: Apply subtle box-shadow for web elevation
- **Colors**: Exact same hex values, adjust opacities for web CSS
- **Modals**: Use web modal patterns (overlay + centered box) instead of pageSheet
