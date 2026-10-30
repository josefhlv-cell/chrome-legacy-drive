# Architecture rules
- Smart Capture keeps one guided 20-shot sequence; session metadata stores skipped steps and capture progress without requiring schema changes.
- Accepted capture photos use a durable IndexedDB queue, with upload independent of advisory analysis, so leaving the camera does not discard pending images.
- Mobile Smart Capture is capture/handoff only; desktop uses the same session IDs for review, completion and export.