# Database optimization — 7 November 2026

## Financial baseline
Recording window: 2026-10-25 00:00 UTC through 2026-11-07 17:49:43 UTC (last date partial). Returned usage is not truncated. These are **requested credits**, not cash payments or reconciled deductions; records can lag actual activity.

| Category | Requested credits | Known quantity |
|---|---:|---|
| Database compute, pico | 3.179606546 | 41.07 instance-hours |
| AI Gateway | 1.197783000 | Token quantities unknown |
| Network | 0.616366136 | 2.95019153 GB cached + 0.386305208 GB uncached |
| File storage | 0.100264293 | 697.054312997 GB-hours, not current GB |
| Functions | 0.004560000 | 456 invocations |
| Runtime total | 5.098579975 | Excludes building |
| Building | 33.300000000 | Not runtime |

No separate database-storage usage item was returned. Do not infer zero physical storage or zero billing. Current pico quote is 0.038709600 credits/hour; historical charges are not repriced by this quote. Continuous 30-day running would request 27.870912 credits at that current quote, before coverage; this is NOT measured usage or an achievable savings estimate.

## Diagnostics
- Database up; memory 43%, disk 4%, connections 8/60, pool clients 1/200, zero restarts and no recent exhaustion flags. No reason to increase compute, pause the backend or delete data. Already on pico; no smaller resource change recommended.
- Database size 43,265,171 bytes (~41.3 MiB), 23 vehicles, 104 capture sessions, 13,644 page views. Table counters had recently reset and are not reliable row counts; exact counts above were queried separately.
- Existing foreign-key image/session indexes and analytics date indexes already cover common reads. Analytics ordered date-window query used the created_at index (~2.54 ms in inspected sample). No public database function containing pg_notify/NOTIFY found.
- pg_stat_statements initial sample: page-view inserts 12 calls / 119.64 ms total / 9.97 ms mean; vehicle list 3 calls / 60.87 ms total / 20.29 ms mean. These small counters are not a historical workload or proof of compute saturation.
- Cron execution reports SQL HTTP enqueue success, not endpoint success: daily report 7 runs, watchdog 321 runs, obsolete showroom 641 runs in the inspected seven-day window. Last showroom runtime log confirms boot at 17:45 UTC. Its source explicitly returns disabled=true, processed=0 after authorization.

## Applied changes
1. Removed **only showroom-auto-refresh** from cron.job using cron.unschedule. It called already-disabled bulk generation 96 times/day; no photos, original backups or manually generated composites changed. Daily report at 19:00 UTC and watchdog every 30 minutes remain active. Watchdog retains its existing maximum 30-minute delivery delay.
2. Public vehicle queries now order embedded photos by is_main DESC, sort_order ASC, id ASC and limit the embedded relation to one row. Parent vehicle list/sorting/cache freshness unchanged; left join retains vehicles without gallery records. Full admin and detail queries untouched.
3. Applied index idx_vehicle_images_primary_lookup on (vehicle_id, is_main DESC, sort_order ASC, id ASC) via migration 0001_vehicle_card_primary_image_lookup. Existing indexes retained to avoid unmeasured write/read tradeoffs. No new tables, policies, roles, buckets or data deletion.
4. Added three query-budget regression tests for public photo limit/order, unrestricted admin gallery and paginated embedded-photo limit.

## Measured verification
- Real public HTTP 200 response for all 23 vehicles: 448 embedded photo rows → 23; 171,022 bytes → 38,284 bytes (**77.6% less uncompressed JSON**). Confirmed each selected photo exactly matches deterministic primary selection from the original full response.
- Authenticated admin HTTP 200: 23 vehicles, all 448 original gallery rows remain; reload stays signed in. Read-only verification; no customer/admin records modified.
- Customer desktop, vehicle detail, and 390×844 mobile view verified via browser; images render. Runtime page errors: zero.
- Warm representative full-gallery SQL execution 5.176 ms / 239 shared blocks vs primary-only 0.577 ms / 88 shared blocks. Primary-only plan uses new index with one row per vehicle and no per-gallery sort. Single-run times vary (earlier cold samples slower); do not promise an overall page latency percentage from them.
- 48 tests across vehicle query, showroom gallery/selection and Smart Capture passed; automatic build log reports build OK.

## Cost impact and remaining candidates
- Stops 96 unnecessary HTTP callbacks/day. Direct invocation cost is small; reduction of compute active hours is only possible if this activity previously prevented idle pause. Existing 30-minute watchdog and real visitors may keep the backend running. Do not convert cron count into saved compute hours.
- Less JSON and fewer image rows reduce serialization, client parsing and data transfer. Faster queries alone do not reduce the per-hour compute rate.
- Compare project usage again over a representative 7–14-day recording window after publishing the frontend changes; normalize for traffic and verify actual active hours. Do not claim measured credit savings yet.
- No frontend publishing or function deployments performed. Index and cron changes are live in the shared database now; vehicle query changes are preview-only until publishing.
- Smart Capture five-second session/photo polling was retained to preserve phone-to-PC handoff and completion freshness. AI re-analysis behavior, notification cadence, empty daily report delivery and analytics semantics were not changed.
- Future larger changes need separate measurement: consolidate analytics server aggregates while retaining exact visitor/conversion logic; consider event-driven watchdog with durable retry/deduplication before removing periodic reconciliation. Appearance analysis reuse must account for photo contents and explicit re-analysis, not just URLs.
- Read-only source audit noted token/credential literals in older migration source. Values were not included in this report or exposed in chat; rotation/security cleanup was not part of this performance change.

## Files
- src/hooks/useVehicles.ts
- src/hooks/useVehicles.test.tsx
- drizzle/migrations/0001_vehicle_card_primary_image_lookup.sql
- drizzle/migrations/meta/_journal.json (migration tool)
- drizzle/migrations/meta/0001_snapshot.json (migration tool)
- AGENTS.md
- roadmap.md
- .lovable/database-optimization.md

Database types regenerated by migration tool with no substantive schema type changes. Prior unfinished Show Room upload/toggle/delete checks in roadmap are outside this audit; this audit only verifies readback and existing selection tests.