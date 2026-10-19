// Self-serve business signup (/signup) needs a live backend for the texted code
// and the account itself. Until one is deployed, signup is closed: every
// "Get TaskRight" button goes to the homepage Early Access form (MailerLite, no
// backend) and /signup shows a "not open yet" screen pointing there.
//
// Open it with NEXT_PUBLIC_SIGNUP_OPEN=true: in TaskRight-Website/.env.local for
// local dev against the local backend, and in Vercel once production has a
// backend. NEXT_PUBLIC_ values are fixed at build time, so Vercel needs a redeploy.
export const SIGNUP_OPEN = process.env.NEXT_PUBLIC_SIGNUP_OPEN === 'true';

export const SIGNUP_HREF = SIGNUP_OPEN ? '/signup' : '/#early-access';
