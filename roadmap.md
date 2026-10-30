# Smart Capture
- [ ] Add safe Save and finish: preserve photos/skips for desktop, detach finished mobile session, verify new capture after reload.
- [x] Fix crash-safe accepted-photo/progress persistence and reopening the last mobile session.
- [x] Verify refresh/offline recovery, tab reopening, camera restart/landscape and desktop ZIP readback in four authenticated Chromium test cycles; 15 unit tests pass. Physical iPhone/Safari camera permission and OS process termination remain unverified (no physical device available).
- [x] Soft 20-step capture with persisted skips and advisory-only AI.
- [x] Background durable photo queue with filmstrip states and retry.
- [x] Mobile capture/link handoff; desktop sessions/detail/completion/ZIP.
- [x] Fix main photo, storage URLs and session creation failure.
- [x] Test rules and authenticated mobile-to-desktop flow (10 unit tests, session failure, upload retry, 19 skips, PC ZIP, completion, saved form and landscape retake).