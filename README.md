# Target Debugging Tool

Target Tracker for Bosta account managers: compares each AM's monthly revenue target with merchant-level performance (MTD, run-rate, monthly history, last activity).

> **Private / internal.** `src/TargetTracker.jsx` contains real merchant and target data. Do not make this repo public.

## Run locally

```bash
npm install
npm run dev      # opens http://localhost:5173
```

## Build

```bash
npm run build    # static site in dist/
```

## Updating the data

The data snapshot is the `DATA` object at the top of `src/TargetTracker.jsx`. Replace it with a fresh export and commit.
