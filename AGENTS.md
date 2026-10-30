# Architecture rules
- Smart Capture keeps one guided 20-shot sequence; session metadata stores skipped steps and capture progress without requiring schema changes.
- Accepted capture photos and their progress share a durable IndexedDB record; advance only after the local transaction commits, never after network upload or advisory analysis, to survive abrupt browser closure.
- Mobile camera tracks are stopped on page hiding and reacquired by a user gesture; stale async camera requests must stop their tracks to avoid iOS frozen previews and camera leaks.
- Mobile Smart Capture is capture/handoff only; desktop uses the same session IDs for review, completion and export.