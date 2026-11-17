# Installable app (PWA)

The web build can be installed on a phone, tablet or computer. It opens in its own window with an app icon.

## Files
- `web/public/manifest.webmanifest`: app name, icons, colours.
- `web/public/sw.js`: service worker (see rules below).
- `web/public/offline.html`: shown when the page cannot load and nothing is cached.
- `web/public/icons/`: 192, 512, maskable and Apple icons. Replace them with the Bosta logo files when you have them (same names and sizes).
- `web/src/main.jsx`: registers the worker in the production build.
- `nginx.conf`: serves `sw.js` and the manifest with no-cache so updates reach users.

## What is cached
- App code (`/assets/*`): cached after first load.
- Page (`index.html`): network first, cached copy when offline.
- Data (`payload*.json`, `pricing_store*.b64`, `/api/`): never cached. Merchant and pricing data is not stored on the device by the worker and is always fresh. Offline, the app opens but cannot show data.

## Requirements
- The site must be served over HTTPS (localhost also works). Browsers refuse service workers on plain HTTP.

## Install
- Android or desktop Chrome/Edge: open the site, use the install icon in the address bar or menu.
- iPhone/iPad Safari: Share, then Add to Home Screen.

## Ship an update
Rebuild (`npm run web:build`) and redeploy. Change `VERSION` in `sw.js` only if you change cached file names or rules; the page itself updates on the next visit.

## Check
`npx vite build web`, serve `dist-web/` over HTTPS or localhost, then in Chrome DevTools > Application check Manifest and Service Workers. Lighthouse shows the PWA install check.
