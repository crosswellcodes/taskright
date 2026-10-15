// Shared Team-module types (WEB_PORTAL M5).

export type TeamMember = {
  id: number;
  name: string;
  phoneNumber: string;
  weeklyHours: number;
  hourlyRate: number | null;
  groups: { id: number; name: string }[];
  inviteAccepted: boolean;
  inviteCode: string | null;
};

export type TeamGroup = {
  id: number;
  name: string;
  memberCount: number;
  members: { id: number; name: string }[];
};

export type ActiveClock = {
  teamMemberId: number;
  teamMemberName: string;
  selectionCycleId: number;
  customerId: number;
  customerName: string;
  arrivalAt: string;
};

export type RangeAssignment = {
  selectionCycleId: number;
  serviceDate: string;
  customerId: number;
  teamMemberId: number | null;
  teamMemberName: string | null;
  teamId: number | null;
  teamName: string | null;
};

// The same text the app's AddTeamMemberScreen shares with a new member.
export function inviteMessage(name: string, code: string) {
  return `Hi ${name}, you've been added to TaskRight! Your invite code is: ${code}. Download the app and use this code to accept your invite.`;
}
