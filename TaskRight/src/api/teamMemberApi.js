import { get, patch, post } from './client';

export const getMyJobs = (teamMemberId) =>
  get(`/api/team-members/${teamMemberId}/jobs`);

export const getJobDetail = (teamMemberId, selectionCycleId) =>
  get(`/api/team-members/${teamMemberId}/jobs/${selectionCycleId}`);

export const completeJob = (teamMemberId, selectionCycleId, notes) =>
  patch(`/api/team-members/${teamMemberId}/jobs/${selectionCycleId}/complete`, { notes: notes || null });

export const postGeofenceEvent = (teamMemberId, selectionCycleId, eventType, lat, lng, method = 'auto') =>
  post(`/api/team-members/${teamMemberId}/jobs/${selectionCycleId}/geofence`, {
    eventType,
    occurredAt: new Date().toISOString(),
    lat,
    lng,
    method,
  });
