// The seven go-live modules, fixed order — WEB_PORTAL.md §0 / §4.
export const DASHBOARD_NAV = [
  { label: 'Home', href: '/dashboard' },
  { label: 'Schedule', href: '/dashboard/schedule' },
  { label: 'Customers', href: '/dashboard/customers' },
  { label: 'Messages', href: '/dashboard/messages' },
  { label: 'Team', href: '/dashboard/team' },
  { label: 'Money', href: '/dashboard/money' },
  { label: 'Account & Billing', href: '/dashboard/account' },
] as const;
