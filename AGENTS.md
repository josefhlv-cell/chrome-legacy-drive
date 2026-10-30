# Architecture rules
- Smart Capture keeps one guided 20-shot sequence; session metadata stores skipped steps and capture progress without requiring schema changes.
- Accepted capture photos and their progress share a durable IndexedDB record; advance only after the local transaction commits, never after network upload or advisory analysis, to survive abrupt browser closure.
- Capture readiness is checked independently of media events; JPEG callbacks and local persistence have bounded recovery paths so stalled browser APIs cannot silently lock capture controls.
- Mobile camera tracks are stopped on page hiding and reacquired by a user gesture; stale async camera requests must stop their tracks to avoid iOS frozen previews and camera leaks.
- Mobile Smart Capture is capture/handoff only; desktop uses the same session IDs for review, completion and export.
- Capture completion waits for durable remote photos and progress, marks metadata as finished, then clears the active-session pointer without deleting the saved review session; this prevents mobile auto-resume while retaining desktop export.