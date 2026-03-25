# Pending Setup Tasks — Requires External Action or Cost

These items are fully wired in code but require a manual step, account creation, or paid service to activate. Complete these together in one focused session when ready.

---

## 🌐 Domain & Hosting

- [ ] **Purchase domain** — `taskright.com` (or closest available)
  - Recommended registrars: Namecheap, Cloudflare Registrar (no markup)
  - Unlocks: Google Search Console, production GA4 data, real OG image sharing, live Mailchimp signups

- [ ] **Deploy website to hosting** — Vercel recommended (free tier works for Next.js)
  - Connect GitHub repo (`crosswellcodes/taskright`)
  - Set root directory to `TaskRight-Website/`
  - Add environment variables (see below)
  - Point domain DNS to Vercel after purchase

---

## 📊 Google Analytics 4

- [ ] **Get Measurement ID** from analytics.google.com
  - Already walked through property setup steps — just need the `G-XXXXXXXXXX` ID
  - Add to `TaskRight-Website/.env.local`: `NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX`
  - Add same value to Vercel environment variables for production
  - Script tags already wired in `src/app/layout.tsx` ✅
  - Form submission event already wired in `EarlyAccessForm.tsx` ✅

- [ ] **Mark form_submission as a Conversion** in GA4
  - GA4 → Configure → Events → find `form_submission` → toggle "Mark as conversion"
  - Do this after at least one test form submission has been recorded

---

## 🔍 Google Search Console

- [ ] **Verify domain ownership** at search.google.com/search-console
  - Requires live domain first
  - Choose "HTML tag" verification method → copy the `content=""` value
  - Add to `TaskRight-Website/.env.local`: `NEXT_PUBLIC_GSC_VERIFICATION=<code>`
  - Add same value to Vercel environment variables
  - Meta tag already wired in `src/app/layout.tsx` ✅

- [ ] **Submit sitemap** after domain is verified
  - URL to submit: `https://taskright.com/sitemap.xml`
  - Dynamic sitemap already built at `src/app/sitemap.ts` ✅

---

## 📧 Mailchimp (Email Capture)

- [ ] **Create Mailchimp account** at mailchimp.com (free up to 500 contacts)
- [ ] **Create audience** — name it "TaskRight Beta Applicants"
- [ ] **Get API key** — Account → Extras → API Keys
- [ ] **Wire EarlyAccessForm.tsx** to Mailchimp API
  - Form fields already built: Name, Email, Business Type, State, Customer Count ✅
  - Currently form submissions are local-only (no backend call yet)
  - Will need: API route in Next.js (`/api/subscribe`) + Mailchimp SDK call
- [ ] **Set up welcome email sequence** in Mailchimp
  - Email 1 (immediate): "We received your application" confirmation
  - Email 2 (day 3): What TaskRight does, what beta means
  - Email 3 (day 7): What to expect next, invite to follow along

---

## 📱 Twilio SMS (Backend — Notification Service)

- [ ] **Create Twilio account** at twilio.com
- [ ] **Purchase a phone number** (~$1/month)
- [ ] **Add credentials to `backend/.env`**:
  ```
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
  ```
- Notification service already built at `backend/src/services/notificationService.js` ✅
- Cron jobs already integrated (`selection-reminders.js`, `auto-repeat.js`) ✅
- Install `node-schedule`: `cd backend && npm install node-schedule`

---

## 🖼️ Asset Replacements (Design)

- [ ] **Replace `public/og-image.svg`** with a proper PNG (1200×630px, <500KB)
  - Twitter/X and some older crawlers require PNG or JPG — SVG works for most modern platforms but not all
  - Update reference in `layout.tsx`: `/og-image.svg` → `/og-image.png`

- [ ] **Replace `public/logo.svg`** with real brand logo asset when design is finalized
  - Update reference in `layout.tsx` Organization schema

---

## 📝 Notes

- **All code is complete** — nothing above blocks development or testing
- **Order of operations when ready**: Domain → Hosting/Vercel deploy → GA4 ID → GSC verify → Mailchimp wire-up → Twilio
- **Zero-cost testing**: Everything works locally without these steps — expenses only hit when going live
