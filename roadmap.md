# Vehicle admin background generation
- [x] Add collapsed generator beside original gallery using existing primary-only endpoint, original/result previews and download without automatic activation.
- [x] Verify authenticated desktop/mobile expansion, original/result rendering and preserved source; 15 regression tests and preview build OK. Frontend not published; no function/schema edits.
- [ ] Successful fresh-generation verification blocked by existing deployed showroom-generate vision gate: HTTP 502, AI visual review returned no valid JSON. Existing saved result renders; reopening it makes no paid request. Backend repair/deployment is outside this frontend addition.

# Database performance and running credits
- [x] Measure project usage, query plans, indexes, table sizes and scheduled work (2026-11-07; scoped requested runtime credits 5.09858, pico 41.07 instance-hours; healthy resources).
- [x] Apply evidence-backed optimizations without deleting data or changing required freshness: unschedule disabled showroom-batch polling; select one deterministic embedded card photo and add matching index.
- [x] Verify database plans and customer/admin readback: 23 vehicles, 448→23 embedded photos, 171022→38284 bytes; full admin gallery/reload preserved; mobile/detail checks, 48 tests and build OK. Measured credit savings require later representative usage comparison. Findings in .lovable/database-optimization.md.

# Show Room gallery
- [ ] Inspect existing admin/public galleries, schema and storage permissions.
- [ ] Add isolated persisted gallery and independent activation with safe storage removal.
- [ ] Verify authenticated upload/reload/toggle/delete and public-only selection; run tests and inspect build result.

# Smart Capture
- [x] Connect GPT Image 2.5 Sunburst through Lovable with authenticated primary-only processing, preserved originals and paid-call replay protection.
- [x] Verify real authenticated AI output, queue retry protection, regression tests and current build; 51 tests passed, actual image edit succeeded in 31.862s for 0.106672 credits, mobile upload/reload verified. New function deployed; frontend not published.
- [x] Repair local AI showroom processing: bundled runtime, primary-only background jobs, preserved originals and fixed background.
- [x] Test local inference, saved original/processed readback, failure recovery and build; 49 tests passed, authenticated mobile upload/reload passed; AGPL production compliance and physical iPhone performance remain unverified.
- [x] Fix intermittent capture/next-button locks: poll camera readiness, recover stalled JPEG/local transactions, show saving feedback; 25 tests, lint and four authenticated mobile browser cycles passed (timeout, offline next/skip, reload/retake, camera restart/finish and PC readback). Physical iPhone remains unverified.
- [x] Add safe Save and finish: preserve photos/skips for desktop, detach finished mobile session, verify new capture after reload; 20 unit tests and four authenticated browser cycles passed (upload failure, save failure, new capture after reload, PC ZIP).
- [x] Fix crash-safe accepted-photo/progress persistence and reopening the last mobile session.
- [x] Verify refresh/offline recovery, tab reopening, camera restart/landscape and desktop ZIP readback in four authenticated Chromium test cycles; 15 unit tests pass. Physical iPhone/Safari camera permission and OS process termination remain unverified (no physical device available).
- [x] Soft 20-step capture with persisted skips and advisory-only AI.
- [x] Background durable photo queue with filmstrip states and retry.
- [x] Mobile capture/link handoff; desktop sessions/detail/completion/ZIP.
- [x] Fix main photo, storage URLs and session creation failure.
- [x] Test rules and authenticated mobile-to-desktop flow (10 unit tests, session failure, upload retry, 19 skips, PC ZIP, completion, saved form and landscape retake).