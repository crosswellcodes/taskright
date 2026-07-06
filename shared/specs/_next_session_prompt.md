<!--
  Seed prompt for the NEXT session. Paste the fenced block below to start it.
  Scope: design/spec-only first session for the per-customer service model change.
  Ethos: SURGICAL as an APPROACH, not a scale cap — precise, deliberate changes scoped
  to exactly what the end result needs. Don't reshape the core gratuitously; don't shy
  away from substantial work where it's genuinely required. Right-size, justified by outcome.
-->

# Next Session Seed Prompt — Service Model (per-customer)

```
Session: Service Model — Component 0 of N (DESIGN + SPEC ONLY, no production code)

Goal: Rework how services are built. Today we force a business-global service cycle to be
built first (the "Cycles" tab) and then assigned to a customer. I want services to be created
directly on the customer profile and to move to a PER-CUSTOMER service model — each customer's
service is its own record (it may be seeded from a reusable template/library, but is decoupled
after creation). The current build-then-assign split feels disjointed, especially now that job
costing and review requests have been layered on top of it.

Be SURGICAL — this is about APPROACH, not scale. I understand the impact of this change. Make
precise, deliberate changes scoped to exactly what the end result requires: do NOT reshape the
core of the product gratuitously, but do NOT shy away from substantial work where it's genuinely
needed to reach the outcome. Right-size every change and justify it by the result, not by a bias
toward "small." Preserve the working job-costing and review-request plumbing where you can, but
don't contort the design to avoid necessary change.

This session is DESIGN ONLY. Do NOT write production code, migrations, or UI. The single
deliverable is a written spec + a phased implementation plan we agree on. Mirror how
JOB_COSTING.md and REVIEW_REQUESTS.md started (spec-first cadence). Use plan/investigation
mode; the only files you may WRITE this session are the new spec doc and doc-registry/HANDOFF
pointers — nothing under backend/src, TaskRight/src, or migrations/.

Read first for full context:
- HANDOFF.md — current state; §"Database Tables" and the Session 9–13 blocks. Note the whole
  recurring chain hangs off service_cycles.
- backend/migrations/001_initial_schema.js — service_cycles, customer_cycle_assignments,
  task_assignments, selection_cycles. Plus 002_scheduling_format.js (day_of_week),
  017–019 (job costing: price_per_visit on customer_cycle_assignments, price on
  selection_cycles, job_costs), 020_review_tokens.js (review_tokens → selection_cycles).
- shared/API_REFERENCE.md — service-cycle + job-costing + review endpoints that touch this data.
- shared/specs/JOB_COSTING.md, JOB_COSTING_DATA_GAPS.md, REVIEW_REQUESTS.md — the features that
  now depend on this model; the overhaul must not break them.
- Mobile screens: TaskRight/src/screens/business/ServiceCyclesScreen.js (the "Cycles" tab that
  builds cycles globally), AssignCycleScreen.js (assign existing cycle to a customer),
  CustomerDetailScreen.js (where creation should move to), ServiceCallDetailScreen.js,
  ServiceDaySnapshotScreen.js; TaskRight/src/navigation/BusinessNavigator.js (the "Cycles" tab).

STEP 0 — Before anything, confirm the ground truth and wait for me:
1. Output the current-state map you derived (data model + the exact screens/routes involved) in a
   few bullets so we're aligned before designing. Do NOT start a server or write anything yet.
2. This is design-only, so no full-stack startup is required. If you need to inspect live schema,
   read-only psql on task_app_db is fine (/opt/homebrew/opt/postgresql@18/bin/psql). Ask before
   anything that mutates.

Scope for THIS session — produce shared/specs/SERVICE_MODEL.md (name TBD, propose one) covering:

1. Current-state audit — the build-then-assign flow, every table/column and screen involved, and
   a precise statement of WHAT is disjointed (entry points, duplicated concepts, where job-costing
   price and review triggers attach today).

2. Target model — PER-CUSTOMER service definitions created on the customer profile, plus the
   "library" concept. Resolve WITH ME (these are the open questions, don't unilaterally pick);
   for each, lead with the option that best serves the end result with the least incidental
   disruption, and state its blast radius honestly (including when the right answer is the larger
   change):
   - Does a per-customer service get its own table, or does customer_cycle_assignments absorb the
     definition fields (name/frequency/deadlines/tasks) so service_cycles becomes only a template
     library? Show the schema both ways with trade-offs and a recommendation.
   - Is the "library" a business-global set of reusable TEMPLATES you seed from, a per-customer
     list of that customer's services, or both? Define exactly what "stored as a library" means.
   - Backwards-compat: selection_cycles.service_cycle_id, task_assignments, generateUpcoming-
     SelectionCycles (D2 price copy), job_costs, and review_tokens all currently key off
     service_cycles / customer_cycle_assignments. Spell out how each is preserved or migrated so
     job costing and review requests keep working. This is the make-or-break section.
   - Migration strategy for EXISTING data (current businesses have global service_cycles +
     assignments + live selection_cycles). Backfill plan, and whether it's additive or a cutover
     — choose by what the end result actually needs; prefer preserving working plumbing, but pick
     a cutover if that's the cleaner path to the outcome.
   - Fate of the "Cycles" tab and AssignCycleScreen — repurpose as a library browser, remove, or
     keep? Proposed new navigation/IA and the customer-profile creation flow.
   - Terminology: "service cycle" vs "service" — propose the vocabulary and note rename scope.

3. Phased plan — break the build into components sized like the job-costing/review cadence
   (data+backend first, then UI slices), each independently shippable and test-covered, with an
   explicit ordering and the migration number(s) to reserve (next free is 021).

4. Open questions / decisions log — anything we defer, captured like the "Resolved Decisions"
   sections in the other specs.

Verification for a design session = the spec itself, reviewed with me. No tests to run. When the
spec is drafted, walk me through the recommendation on each open question and get my sign-off
BEFORE finalizing. Then: commit the spec, add it to shared/DOC_REGISTRY.md (§specs), and add a
HANDOFF.md Pending Work entry pointing at Component 1. Do NOT touch app/backend code.

Treat nothing as settled until I confirm. Surface every trade-off and let me decide. Be precise
and deliberate — do what the outcome genuinely requires, no more and no less; keep the working
plumbing intact where you can, but don't avoid a necessary change to stay "small."
```
