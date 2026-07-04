# TaskRight — Doc Registry & Ownership Map

**Purpose:** Single reference for what each doc owns and what must stay in sync when it changes. Read this before making cross-cutting changes, and use it to drive the post-session consistency review.

---

## Document Inventory

### `HANDOFF.md` (project root)
**Owns:** Current build state, DB schema (table list + all columns), architectural decisions, pending work checklist, error patterns, dev environment setup, per-session change log.
**Updated:** Every session.
**Must sync with:**
- `shared/API_REFERENCE.md` — route list in HANDOFF must match documented endpoints
- `shared/FEATURE_MAPPING.md` — feature status (✅/❌) must match what HANDOFF says is built
- `shared/PRODUCT_OVERVIEW.md` — "Current Phase" section must reflect HANDOFF build state
- `shared/specs/*.md` — any feature spec that reaches "implemented" status must be reflected in HANDOFF DB tables and pending work

---

### `SPEC.md` (project root, ~75KB — use offset/limit)
**Owns:** Full original product specification, feature design intent, original data model definitions.
**Updated:** Rarely — only for major scope or design changes.
**Must sync with:**
- `HANDOFF.md` — when an architectural decision diverges from spec, HANDOFF is the source of truth; add a note in SPEC if the divergence is permanent
- `shared/specs/*.md` — feature specs should not contradict the overall product design in SPEC

---

### `shared/API_REFERENCE.md`
**Owns:** All endpoint signatures, request/response shapes, auth patterns, error formats.
**Updated:** When new routes are added or existing routes change.
**Must sync with:**
- `HANDOFF.md` — route list in HANDOFF "What's Fully Built → Backend" must match documented endpoints
- `shared/specs/*.md` — new feature specs must add their endpoints here when implemented
- `backend/src/routes/` — actual implementation is ground truth; API_REFERENCE documents what's live

---

### `shared/FEATURE_MAPPING.md`
**Owns:** Which features live on mobile vs. web, platform decision criteria, website phase plan, feature status matrix.
**Updated:** When features ship or platform decisions change.
**Must sync with:**
- `HANDOFF.md` — feature status symbols (✅/❌/🔄) must match HANDOFF "What's Fully Built"
- `shared/PRODUCT_OVERVIEW.md` — "Current Phase" and feature completeness must align

---

### `shared/PRODUCT_OVERVIEW.md`
**Owns:** Mission statement, user personas, key user flows, high-level design system (colors, type scale).
**Updated:** When personas, mission framing, or brand tokens change.
**Must sync with:**
- `HANDOFF.md` — "Current Phase" section must not describe features as unbuilt if HANDOFF says they're complete
- `shared/DESIGN_SYSTEM.md` — color values and type tokens must match
- `shared/FEATURE_MAPPING.md` — feature completeness must be consistent

> ⚠️ Known stale entry (as of Session 8): PRODUCT_OVERVIEW.md still says "Website: Not Started." The website is live with a full landing page, signup flows, and customer join pages. Update next time this file is touched.

---

### `shared/DESIGN_SYSTEM.md`
**Owns:** Full design token reference — colors, spacing, typography, component patterns.
**Updated:** When brand tokens or UI patterns change.
**Must sync with:**
- `shared/PRODUCT_OVERVIEW.md` — the abbreviated design section in PRODUCT_OVERVIEW must match
- `TaskRight-Website/src/` — Tailwind classes and component styles should reflect the system

---

### `TASKRIGHT_SEO_ACTION_PLAN.md` (project root)
**Owns:** SEO roadmap, GA4 integration steps, GSC setup, content strategy phases.
**Updated:** When SEO items are completed or strategy changes.
**Must sync with:**
- `HANDOFF.md` — "Phase 1 SEO" items in pending work must match what this doc lists as incomplete

---

### `shared/specs/` (future — created as features are designed)
**Owns:** Per-feature data models, API surface, business rules, open questions for features not yet in SPEC.md.
**Convention:** Each file is self-contained. When a feature ships, update HANDOFF.md (DB tables, pending work) and API_REFERENCE.md (new endpoints). The spec file stays as the design record.
**Files:**
- `shared/specs/JOB_COSTING.md` — Job costing equation, cost categories + chart of accounts codes, geo-fencing infrastructure (geocoding, arrival/departure events), per-job and per-customer profitability views. Migrations 017–018.
- `shared/specs/JOB_COSTING_DATA_GAPS.md` — Pre-UI data-model decisions (manual vs auto labor, price population, team-job scope), migration `019_job_costing_integrity` (constraints/indexes/backfill), and the unbuilt service/API layer. Must be cleared before job-costing UI work. Depends on JOB_COSTING.md.
- `shared/specs/REVIEW_REQUESTS.md` — SMS review request flow, no-auth `/review/[token]` page, review_tokens table, feedback source tracking, opt-out model. Depends on geo-fencing from JOB_COSTING.md.

> ⚠️ Migration-number collision: `JOB_COSTING_DATA_GAPS.md` claims `019` (job costing integrity) and `REVIEW_REQUESTS.md` previously also claimed `019`. Resolution: job-costing integrity takes **019** (it must land before UI and before review requests, which depends on geofencing); **REVIEW_REQUESTS migration is now 020**. Confirm the actual next free number at implementation time (018 is the current highest that exists).

---

## Sync Rules (apply after every session)

1. **New route added** → update `API_REFERENCE.md` + `HANDOFF.md` route list
2. **New DB table or column** → update `HANDOFF.md` schema section
3. **Feature completed** → update `HANDOFF.md` pending work (check it off) + `FEATURE_MAPPING.md` status matrix
4. **Architectural decision changed** → update `HANDOFF.md` decisions section; note divergence in `SPEC.md` if permanent
5. **New feature spec written** → register it in this file under `shared/specs/`
6. **Brand/design token changed** → update both `DESIGN_SYSTEM.md` and the abbreviated section in `PRODUCT_OVERVIEW.md`

---

## Post-Session Review Prompt

At the end of any session where code or docs changed, run:

> "Review the TaskRight docs for consistency. Read `shared/DOC_REGISTRY.md` for the ownership map. Then check each doc listed there against its declared sync targets. Report only actual gaps — a feature described as unbuilt in one doc but complete in another, an endpoint in the code with no API_REFERENCE entry, a DB column in HANDOFF with no migration, etc. Output a numbered list of gaps found, or 'Docs in sync.' if clean. Keep it under 200 words."

This prompt is also wired as a Claude Code stop hook — it fires automatically when each session ends.
