# Smart Capture via Lovable AI

- Model: openai/gpt-image-2.5-sunburst, image-edit surface, high quality, 1536×1024 transparent PNG, one output.
- AI isolates only the source vehicle. Browser composition retains the exact fixed 1500×846 showroom JPEG, including wall logo. Originals and listing transfer remain unchanged.
- New smart-capture-showroom endpoint verifies bearer session, protected admin role and capture-session ownership; rejects non-primary shots. Uses the official Gateway SDK and generated model contracts. No user OpenAI key.
- A unique per-photo storage lock and cached response prevent concurrent or repeated paid edits. Local IndexedDB also retains attempted/completed state. Unknown outcomes do not automatically replay; original upload remains available. Cache/lock files are scoped inside the existing capture session folder.
- Existing unrelated analysis/VIN calls and original/public-gallery rules unchanged. No database migration.
- New function deployed to shared Lovable Cloud for testing; frontend not published.

## Verified 2026-11-08 UTC
- Real authenticated mobile UI flow: accept original, advance before AI completes, upload, reload saved gallery; temporary session/files removed.
- Original upload: 1303709 bytes, exact source size; processed output: 230107 bytes, separate URL.
- Gateway log confirms one successful Sunburst image_edits call, HTTP 200, 31.862 seconds, 1564 input / 1372 output tokens, 0.106672 workspace credits. This is measured for one photograph, not a fixed future rate or quality guarantee.
- 51 regression tests passed. Preview build OK. Physical iPhone and broader image-quality sample remain unverified.