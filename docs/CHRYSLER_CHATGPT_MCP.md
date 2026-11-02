# Chrysler.cz ↔ ChatGPT MCP integration

Status: architecture preparation on `feature/chrysler-chatgpt-mcp`. No production files, database rows, storage objects, or deployments have been changed.

## Existing application behavior discovered

- The Vite/React app is deployed as a static frontend on Vercel.
- Supabase project ref configured in the repository: `thqyzghifwmwohgfvshf`.
- Vehicle source photos are stored in the `vehicles` bucket and represented by `vehicle_images`.
- The showroom pipeline already exists as Supabase Edge Functions:
  - `showroom-generate` generates a composite for a single image and requires a signed-in user with the `admin` role.
  - `showroom-apply` can apply or restore a generated image.
  - `showroom-batch` is deliberately disabled.
- A separate showroom gallery is represented by `vehicles.show_room_images` and `show_room_enabled`; its files must stay under `show-room/{vehicleId}/`.
- The repository architecture rules explicitly protect original gallery/card images from showroom assets. Keep this behavior unchanged.

## Proposed MCP tools

Read-only:
- `list_vehicles`: paginated, minimal vehicle identity/status data.
- `get_vehicle_photos`: original photo metadata, main-photo flag, and existing showroom asset status.
- `get_showroom_result`: return the generated showroom URL and validation result for a vehicle/photo.

Write actions (require authenticated admin OAuth scope and explicit confirmation):
- `generate_showroom_photo`: call the existing `showroom-generate` function for the selected primary photo only.
- `save_showroom_asset`: save a generated asset to the separate offer-only showroom field/gallery, never to the original card/gallery image.
- `restore_showroom_asset`: restore the showroom-specific state without deleting original files.

The MCP server must not expose service-role credentials to the model or browser. It must validate the OAuth token, audience, expiry, and scopes on every call, then independently verify the Supabase admin role before any privileged action.

## Required implementation decisions

1. Use a remote MCP endpoint over HTTPS (Vercel Node function or a dedicated server).
2. Implement OAuth 2.1 authorization-code + PKCE compatible with ChatGPT. ChatGPT custom MCP does not accept a static API key as a substitute for OAuth.
3. Prefer an established OAuth provider rather than inventing an authorization server. No OAuth provider credentials/configuration are currently present in the inspected repository.
4. Keep generation separate from publication: generate and return a preview first; save/apply only after the user confirms.
5. Keep all writes scoped to the selected vehicle and showroom asset. Never change `vehicles.image_url`, `vehicle_images.image_url`, main-photo flags, or card image selection as part of showroom publishing.
6. Add integration tests for authorization, admin-role enforcement, vehicle ownership, primary-photo selection, and the original-image invariants.

## ChatGPT account compatibility

The current account is on ChatGPT Go. Current OpenAI help documentation does not list Go as a supported plan for custom MCP connections. Full write/modify MCP support is currently documented for Business and Enterprise/Edu; Pro is documented for read/fetch only. Custom MCP connections are configured on ChatGPT web, not in the mobile app. Therefore, code can be prepared now, but this account cannot yet connect and use the write-capable MCP integration.

## Deployment safety

- This branch is isolated from `main`.
- Do not deploy or change production environment variables until OAuth provider, callback URLs, scopes, and token storage are configured and reviewed.
- Do not deploy any unauthenticated write tool.
