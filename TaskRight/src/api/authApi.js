import { post } from './client';

// Every login and signup needs a texted code. Call without otpCode first: the
// backend answers 404/403/409 as before, or 401 OTP_REQUIRED (no token) — then
// sendVerificationCode() and retry with the code the user enters.

export const sendVerificationCode = (phoneNumber) =>
  post('/api/auth/verify/send', { phoneNumber });

export const businessSignup = (name, phoneNumber, schedulingFormat, otpCode) =>
  post('/api/auth/businesses/signup', { name, phoneNumber, schedulingFormat, otpCode });

export const businessLogin = (phoneNumber, otpCode) =>
  post('/api/auth/businesses/login', { phoneNumber, otpCode });

export const customerLogin = (phoneNumber, otpCode) =>
  post('/api/auth/customers/login', { phoneNumber, otpCode });

export const teamMemberAcceptInvite = (phoneNumber, inviteCode) =>
  post('/api/auth/team-members/accept-invite', { phoneNumber, inviteCode });

export const teamMemberLogin = (phoneNumber, otpCode) =>
  post('/api/auth/team-members/login', { phoneNumber, otpCode });
