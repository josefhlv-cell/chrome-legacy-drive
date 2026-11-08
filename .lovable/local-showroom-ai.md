# Local Smart Capture showroom processing

## Choice and cost
Reuse the installed IMG.LY IS-Net FP16 segmentation model, executing on the browser CPU, then deterministically place the cutout on the unchanged 1500×846 JPEG master background. No OpenAI inference, API key, model training, or paid fallback is introduced. Device resources, initial model download, application hosting and photo storage still have costs. Existing unrelated VIN and advisory AI calls are unchanged.

## Safety and scope
- Only the `prava-predni` primary shot receives the optional composite.
- Capture immediately previews the original; acceptance persists that original and the opt-in processing flag in IndexedDB before advancing.
- Background processing runs in the existing single-job upload queue. `_orig.jpg` receives the camera original; only `_web.jpg` receives the composite. Listing transfer already prefers original_url and is unchanged.
- Processing failure saves the original without paid fallback.
- The ONNX runtime is now an explicit bundled dependency, not an unresolved external browser import.

## License requirement
The existing @imgly/background-removal 1.7.0 package is AGPL-3.0. Zero per-image fees do not imply unrestricted proprietary deployment. Before production use, establish compliance with applicable AGPL source/license obligations or obtain an appropriate commercial license. No claim is made that selecting the local approach resolves this requirement. Default model/WASM downloads still use IMG.LY's public asset host; self-hosting remains a possible future deployment decision, not implemented here.

## Verification
- Authenticated browser inference on a real catalog vehicle succeeded: 19.96 seconds cold start, JPEG 190055 bytes, 1500×846; zero runtime exceptions. Visual result preserves the fixed plate and wall logo. This does not establish equal quality for all vehicles or physical iPhone performance.
- Tests cover primary-only selection, opt-in, unchanged original blob, separate composite upload, no paid fallback, failure fallback, and durable acceptance even while inference never resolves.
- Final regression cycle: 49 tests passed; latest preview build OK.
- Authenticated mobile UI flow (430×844): file fallback → accept → next step before inference completion → remote upload → reload gallery. Original stored bytes exactly matched the 1303709-byte source; processed composite was 217773 bytes at a different URL. Temporary verification session and its files were removed. Physical iPhone performance remains unverified.
- Nothing published; no database migration or Edge Function deployment required.