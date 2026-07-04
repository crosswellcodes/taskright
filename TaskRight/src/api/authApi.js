import { post } from './client';

export const businessSignup = (name, phoneNumber, schedulingFormat) =>
  post('/api/auth/businesses/signup', { name, phoneNumber, schedulingFormat });

export const businessLogin = (phoneNumber) =>
  post('/api/auth/businesses/login', { phoneNumber });

export const customerLogin = (phoneNumber) =>
  post('/api/auth/customers/login', { phoneNumber });

export const teamMemberAcceptInvite = (phoneNumber, inviteCode) =>
  post('/api/auth/team-members/accept-invite', { phoneNumber, inviteCode });

export const teamMemberLogin = (phoneNumber) =>
  post('/api/auth/team-members/login', { phoneNumber });
