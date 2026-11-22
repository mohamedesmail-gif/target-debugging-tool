# Theme (Smileys-style redesign)

Styling only. No calculation, data, filter, permission or route was changed.

## Where it lives
- `src/theme.js`: `THEME` tokens and `THEME_CSS` (global rules, hover/focus/disabled, phone and tablet rules).
- `src/tracker.jsx`: `COLORS` (old names, new values), `UI` (shared card, tile, button, pill, input styles), `fillOf()` (chart fills).
- `src/m1_prims.jsx`: shared charts, tables, chips, `InfoTip`, `MPTrendText`.
- `scripts/assemble.py`: puts `theme.js` first and wraps the app in `.tt-root` with the stylesheet.

## Tokens
Page/tiles #FFFFFF, card #F7F7F5, controls #F4F4F2, borders #EFEFEC, navy #21254B, text #1C1D21 / #5F5E5A / #888780, brand red #E30613 (logo and sparse accents), positive #1D9E75, negative #A32D2D, warning #854F0B.

## Deliberate differences from the spec (accessibility)
- Small text uses #6B6A65 instead of #888780 (contrast 5.0:1). #888780 stays for icons and placeholders.
- Input and secondary button outlines use #D6D5CE so they are visible.
- Text-safe green/amber are darker than the chart fills.
- Trend arrows are Lucide icons with hidden "up/down/flat" text. Colour still follows meaning (good/bad), not direction.
- One extra violet (#5B4FA3) keeps the "New" category distinct.

## How to change the look
Edit the values in `THEME.color`, run `npm test`, then `python3 scripts/assemble.py`.

## Charts

Theme A with the teal colours: one teal accent per chart (`chart` #0F9D8A), with `chart2` #7FCFC2, `chartTint` #D6EFEA and `sand` #E9DFC8 for stacked parts. Soft rounded bars, thin 2px lines, values written on the bars and at the line end. No average, baseline, target or reference lines. Green and red only mean up and down; status colours (growers, droppers, …) stay fixed.
