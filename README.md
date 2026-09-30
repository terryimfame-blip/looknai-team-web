# LookNai Team Web

A read-only catalog of published LookNai footage. The static site reads the public `public_clips` collection directly through the Firebase Web SDK. Media previews are placeholders in this Spark release.

## Development

Copy `.env.example` to `.env.local` and provide the Firebase Web app identifiers for the LookNai project. Run `npm ci`, `npm test`, and `npm run dev`. Run `npm run build` to produce the static site in `dist/`.

The GitHub Pages workflow builds and deploys only `dist/`. Its four `VITE_FIREBASE_*` repository variables contain Firebase Web app identifiers, not server credentials. Firestore Rules enforce read-only public access.
