// Mapbox access token — do NOT commit a real token to this file.
// A public token (pk.) with scopes styles:read + geocoding:read is sufficient:
//   https://account.mapbox.com
//
// This file is tracked but kept token-free. Provide the token locally without
// committing it, either by:
//   - setting MAPBOX_ACCESS_TOKEN in your environment, or
//   - pasting it into your working copy after running:
//       git update-index --skip-worktree TaskRight/src/config.js
//     (so your local edit is never staged or committed).
export const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';
