import { useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveClock } from '../api/teamMemberApi';

// Cross-screen "am I clocked in right now?" state (Tier C, GT-C1). The answer is
// derived on the backend from geofence_events — the durable source of truth —
// rather than any screen-local flag, so it survives navigation and app restarts.
// Refetches whenever the host screen regains focus (covers returning from a job
// after clocking in/out) and whenever the app comes back to the foreground.
export default function useActiveClock(teamMemberId) {
  const [activeClock, setActiveClock] = useState(null);

  const refresh = useCallback(async () => {
    if (!teamMemberId) return;
    try {
      const data = await getActiveClock(teamMemberId);
      setActiveClock(data.activeClock || null);
    } catch (e) {
      // Non-fatal: keep the last known state (the banner just doesn't update)
      // rather than flickering the member's clock status on a transient blip.
    }
  }, [teamMemberId]);

  useFocusEffect(
    useCallback(() => { refresh(); }, [refresh])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { activeClock, refresh };
}
