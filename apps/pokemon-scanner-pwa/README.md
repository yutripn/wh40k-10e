# Pokemon Scanner PWA

A personal Pokemon card lookup/scanner helper that uses the public TCGTracking API.

## Features

- Loads Pokemon sets from `https://tcgtracking.com/tcgapi/v1/3/sets`.
- Looks up cards by set + collector number (and optional card name filter).
- Displays market/low prices from the set pricing endpoint.
- Camera helper to keep your card in frame while you enter details.
- Local-only collection saved in browser `localStorage`.
- Installable as a Progressive Web App for iPhone and Windows.

## Run locally

```bash
cd apps/pokemon-scanner-pwa
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Install on iPhone

1. Open the hosted URL in Safari.
2. Tap **Share**.
3. Tap **Add to Home Screen**.

## Install on Windows

1. Open the hosted URL in Edge or Chrome.
2. Use the browser install button (PWA install) in the address bar.

## Deploy options

Any static hosting works: GitHub Pages, Cloudflare Pages, Netlify, Vercel static output, or your own server.
