# Pokemon Scanner PWA

A personal Pokemon card scanner app using the public TCGTracking API.

## Features

- **Scan-first flow**: open camera, run OCR, auto-fill collector number and likely card name.
- **Set lock mode**: lock to one or more sets so matching only searches those sets.
- **Variant picker**: choose card variant (normal/reverse holo/etc.) before saving.
- **Local collection**: save selected variant pricing to browser `localStorage`.
- **Installable PWA** for iPhone and Windows.

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
2. Use the browser install button in the address bar.

## Deploy options

Any static hosting works: GitHub Pages, Cloudflare Pages, Netlify, Vercel static output, or your own server.
