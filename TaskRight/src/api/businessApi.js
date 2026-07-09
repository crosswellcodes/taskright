import { get, post, put, patch, del } from './client';

// Tasks are owned per-service (service_tasks) and per-template (template_tasks) —
// no global task endpoints. They are authored inline via the Service builder
// (AssignCycleScreen) and the Templates editor (ServiceCyclesScreen).

// Service Templates (reusable library — formerly "service cycles")
export const getServiceTemplates = (businessId) =>
  get(`/api/businesses/${businessId}/service-templates`);

export const createServiceTemplate = (businessId, data) =>
  post(`/api/businesses/${businessId}/service-templates`, data);

export const updateServiceTemplate = (businessId, templateId, data) =>
  put(`/api/businesses/${businessId}/service-templates/${templateId}`, data);

export const deleteServiceTemplate = (businessId, templateId) =>
  del(`/api/businesses/${businessId}/service-templates/${templateId}`);

// Customers
export const getCustomers = (businessId) =>
  get(`/api/businesses/${businessId}/customers`);

export const getCustomerDetails = (businessId, customerId) =>
  get(`/api/businesses/${businessId}/customers/${customerId}`);

export const addCustomer = (businessId, data) =>
  post(`/api/businesses/${businessId}/customers`, data);

export const deleteCustomer = (businessId, customerId) =>
  del(`/api/businesses/${businessId}/customers/${customerId}`);

export const updateCustomerDetails = (businessId, customerId, data) =>
  patch(`/api/businesses/${businessId}/customers/${customerId}`, data);

// Per-customer Services (Service Model C2). A Service is the customer's own
// service definition (name/frequency/deadlines/tasks/hours/price/schedule),
// built on the profile — optionally seeded from a template.
export const createCustomerService = (businessId, customerId, data) =>
  post(`/api/businesses/${businessId}/customers/${customerId}/services`, data);

export const getCustomerService = (businessId, customerId, serviceId) =>
  get(`/api/businesses/${businessId}/customers/${customerId}/services/${serviceId}`);

export const updateCustomerService = (businessId, customerId, serviceId, data) =>
  patch(`/api/businesses/${businessId}/customers/${customerId}/services/${serviceId}`, data);

export const deleteCustomerService = (businessId, customerId, serviceId) =>
  del(`/api/businesses/${businessId}/customers/${customerId}/services/${serviceId}`);

// Forecast
export const getForecast = (businessId) =>
  get(`/api/businesses/${businessId}/selections`);

// Upcoming selections for a customer
export const getUpcomingSelections = (businessId, customerId) =>
  get(`/api/businesses/${businessId}/customers/${customerId}/selections/upcoming`);

// Mark Service Complete
export const markServiceComplete = (businessId, customerId) =>
  post(`/api/businesses/${businessId}/customers/${customerId}/mark-service-complete`, {});

// Reschedule a single service call (change order — does not affect future scheduled dates)
export const getServiceCallDetail = (businessId, selectionCycleId) =>
  get(`/api/businesses/${businessId}/selection-cycles/${selectionCycleId}`);

export const rescheduleSelectionCycle = (businessId, selectionCycleId, newServiceDate) =>
  patch(`/api/businesses/${businessId}/selection-cycles/${selectionCycleId}/reschedule`, { newServiceDate });

// Customer Feedback (business view)
export const getLatestCustomerFeedback = (businessId, customerId) =>
  get(`/api/businesses/${businessId}/customers/${customerId}/feedback/latest`);

export const updateFeedbackBusinessNotes = (businessId, feedbackId, notes) =>
  patch(`/api/businesses/${businessId}/feedback/${feedbackId}/business-notes`, { notes });

// Team Members
export const getTeamMembers = (businessId) =>
  get(`/api/businesses/${businessId}/team-members`);

export const addTeamMember = (businessId, data) =>
  post(`/api/businesses/${businessId}/team-members`, data);

export const updateTeamMember = (businessId, memberId, data) =>
  put(`/api/businesses/${businessId}/team-members/${memberId}`, data);

export const deleteTeamMember = (businessId, memberId) =>
  del(`/api/businesses/${businessId}/team-members/${memberId}`);

// Service Assignments
export const getAssignmentsForDate = (businessId, serviceDate) =>
  get(`/api/businesses/${businessId}/assignments?serviceDate=${serviceDate}`);

// assignee: { teamMemberId: number } | { teamId: number }
export const upsertServiceAssignment = (businessId, selectionCycleId, assignee) =>
  put(`/api/businesses/${businessId}/assignments/${selectionCycleId}`, assignee);

export const removeServiceAssignment = (businessId, selectionCycleId) =>
  del(`/api/businesses/${businessId}/assignments/${selectionCycleId}`);

// Messages
export const getCustomerMessages = (businessId, customerId, params = {}) => {
  const parts = [];
  if (params.limit) parts.push(`limit=${params.limit}`);
  if (params.before) parts.push(`before=${params.before}`);
  const qs = parts.length ? `?${parts.join('&')}` : '';
  return get(`/api/businesses/${businessId}/customers/${customerId}/messages${qs}`);
};

export const sendCustomerMessage = (businessId, customerId, body) =>
  post(`/api/businesses/${businessId}/customers/${customerId}/messages`, { body });

// Job Costing (business view) — see shared/specs/JOB_COSTING.md + API_REFERENCE.md
// A "job" is a selection_cycle.
export const getCostCategories = (businessId) =>
  get(`/api/businesses/${businessId}/cost-categories`);

export const getJobCosts = (businessId, selectionCycleId) =>
  get(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`);

export const setJobPrice = (businessId, selectionCycleId, price) =>
  patch(`/api/businesses/${businessId}/jobs/${selectionCycleId}/price`, { price });

// data: { costCategoryId, amount, teamMemberId?, hoursActual? } — always stamped source='manual'
export const addJobCost = (businessId, selectionCycleId, data) =>
  post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`, data);

// data: { amount?, hoursActual? } (at least one) — marks the row source='manual'
export const updateJobCost = (businessId, selectionCycleId, costId, data) =>
  patch(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs/${costId}`, data);

export const deleteJobCost = (businessId, selectionCycleId, costId) =>
  del(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs/${costId}`);

// Aggregate profitability over COMPLETED cycles only (see JOB_COSTING.md Business Rules).
export const getCustomerProfitability = (businessId, customerId) =>
  get(`/api/businesses/${businessId}/customers/${customerId}/profitability`);

// Set the customer's recurring price for an assigned cycle. Feeds D2: future
// cycle generation copies this into new jobs' price. Pass null to clear.
export const setAssignmentPrice = (businessId, customerId, assignmentId, pricePerVisit) =>
  patch(`/api/businesses/${businessId}/customers/${customerId}/assignments/${assignmentId}`, { pricePerVisit });

// Team Groups
export const getTeamGroups = (businessId) =>
  get(`/api/businesses/${businessId}/groups`);

export const createTeamGroup = (businessId, name) =>
  post(`/api/businesses/${businessId}/groups`, { name });

export const getTeamGroupWithMembers = (businessId, groupId) =>
  get(`/api/businesses/${businessId}/groups/${groupId}`);

export const updateTeamGroup = (businessId, groupId, name) =>
  put(`/api/businesses/${businessId}/groups/${groupId}`, { name });

export const setTeamGroupMembers = (businessId, groupId, memberIds) =>
  put(`/api/businesses/${businessId}/groups/${groupId}/members`, { memberIds });

export const deleteTeamGroup = (businessId, groupId) =>
  del(`/api/businesses/${businessId}/groups/${groupId}`);
