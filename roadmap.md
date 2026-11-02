# Show Room gallery
- [ ] Inspect existing admin/public galleries, schema and storage permissions.
- [ ] Add isolated persisted gallery and independent activation with safe storage removal.
- [ ] Verify authenticated upload/reload/toggle/delete and public-only selection; run tests and inspect build result.

# Smart Capture
- [x] Fix intermittent capture/next-button locks: poll camera readiness, recover stalled JPEG/local transactions, show saving feedback; 25 tests, lint and four authenticated mobile browser cycles passed (timeout, offline next/skip, reload/retake, camera restart/finish and PC readback). Physical iPhone remains unverified.
- [x] Add safe Save and finish: preserve photos/skips for desktop, detach finished mobile session, verify new capture after reload; 20 unit tests and four authenticated browser cycles passed (upload failure, save failure, new capture after reload, PC ZIP).
- [x] Fix crash-safe accepted-photo/progress persistence and reopening the last mobile session.
- [x] Verify refresh/offline recovery, tab reopening, camera restart/landscape and desktop ZIP readback in four authenticated Chromium test cycles; 15 unit tests pass. Physical iPhone/Safari camera permission and OS process termination remain unverified (no physical device available).
- [x] Soft 20-step capture with persisted skips and advisory-only AI.
- [x] Background durable photo queue with filmstrip states and retry.
- [x] Mobile capture/link handoff; desktop sessions/detail/completion/ZIP.
- [x] Fix main photo, storage URLs and session creation failure.
- [x] Test rules and authenticated mobile-to-desktop flow (10 unit tests, session failure, upload retry, 19 skips, PC ZIP, completion, saved form and landscape retake).