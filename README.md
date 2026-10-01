# LookNai Team Web

A read-only catalog of published YEP! footage. The static site opens behind a session-only team PIN gate, then reads the public `public_clips` collection directly through the Firebase Web SDK. The gate is a convenience check, not authentication: Firestore remains the access boundary.

Cards render a static GitHub Pages WebP only when the public document explicitly contains valid `previewAvailable`, `previewPath`, and `previewRevision` fields. Images load lazily from the Pages base path and revert to the media placeholder if unavailable. The catalog never downloads source media.

## Development

Copy `.env.example` to `.env.local` and provide the Firebase Web app identifiers for the LookNai project. Run `npm ci`, `npm test`, and `npm run dev`. Run `npm run build` to produce the static site in `dist/`.

The GitHub Pages workflow builds and deploys only `dist/`. Its four `VITE_FIREBASE_*` repository variables contain Firebase Web app identifiers, not server credentials. Firestore Rules enforce read-only public access.
