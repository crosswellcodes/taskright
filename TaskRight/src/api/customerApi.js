import { get, post, postFormData } from './client';

export const getCurrentSelectionCycle = (customerId) =>
  get(`/api/customers/${customerId}/selection-cycle/current`);

export const submitSelections = (customerId, selectionCycleId, data) =>
  post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`, data);

export const getUpcomingServices = (customerId) =>
  get(`/api/customers/${customerId}/upcoming-services`);

export const getSelectionHistory = (customerId) =>
  get(`/api/customers/${customerId}/selection-history`);

export const submitFeedback = (customerId, formData) =>
  postFormData(`/api/customers/${customerId}/feedback`, formData);

export const getFeedbackForCycle = (customerId, selectionCycleId) =>
  get(`/api/customers/${customerId}/feedback/${selectionCycleId}`);
