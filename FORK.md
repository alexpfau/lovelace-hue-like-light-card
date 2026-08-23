# Fork notes

This is a personal fork of [Gh61/lovelace-hue-like-light-card](https://github.com/Gh61/lovelace-hue-like-light-card).

It exists for one reason: **the card should look exactly like a native Home Assistant tile
card, while keeping the Hue-style popup on tap.** The popup is the whole point of the card;
the surface it sits behind should not announce itself as a third-party design.

Upstream is tracked as the `upstream` remote. Keep changes small and clearly separated so
merges stay cheap.

## What changed

### 1. The card renders a real tile instead of imitating one

`src/core/native-tile-factory.ts` (new) asks Home Assistant for a genuine `hui-tile-card`
via `loadCardHelpers()`, and the card renders that. Parity is therefore structural, not
cosmetic — it survives HA restyling its own tile card.

The native `light-brightness` tile feature supplies the brightness slider, so the card no
longer ships its own.

Tap handling:

- every tile action (`tap_action`, `icon_tap_action`, `hold_action`, `double_tap_action`)
  is set to `none`;
- the card listens for `click` **in the capture phase**, because `ha-tile-container` calls
  `stopPropagation` on click and a bubbling listener on the host would never fire;
- taps whose `composedPath()` passes through a slider or card feature are ignored, so
  dragging brightness does not open the dialog.

### 2. The Hue dialog follows the active theme

The dialog rendered as a flat `#171717` slab with grey square tiles regardless of theme.

The non-obvious part: replacing hardcoded colours with `var(--ha-…)` does **not** fix this
on its own. Home Assistant applies a view-level theme as inline custom properties on
`hui-view-container`, and the dialog mounts into `<home-assistant>` — outside that subtree.
Every `var()` resolved to its fallback, i.e. exactly the value it was meant to replace.

`ThemeHelper.copyThemeContext()` copies the theme's custom properties from the card that
opened the dialog onto the dialog itself. It walks the card's ancestor chain rather than
re-resolving a theme name, because the theme may come from the user profile, the view or
the card, and only the card knows which one won. `--hue-*` values are skipped — they
describe one card's light state, not the theme.

### 3. `tileStyle` option

```yaml
type: custom:hue-like-light-card
groupEntity: light.kitchen
tileStyle: true   # default true in this fork
```

- `true` (default) — render as an embedded native tile.
- `false` — the original Hue surface.

A native tile binds to exactly one entity, so a card **without** `groupEntity` cannot use
one. Those fall back to the card's own surface, which now also carries tile-parity CSS as a
second-best. That is why the original rendering path is kept rather than deleted.

### 4. Efficiency

In tile mode `updateStylesInner()` returns early. It was probing the DOM with a throwaway
`ha-card` and recomputing backgrounds and shadows on every state change — none of which
reaches the screen once HA owns the rendering.

## Building and deploying

Development build (`Consts.Dev = true`) registers every element with a `-test` postfix, so
`custom:hue-like-light-card-test` can be tested alongside the stock HACS card:

```bash
npx rollup -c            # -> dist/hue-like-light-card.js
```

A production build flips `Dev = false` and minifies, exactly as upstream's release workflow
does. It registers as `hue-like-light-card`, so it **must not** be loaded at the same time
as the stock card — two modules defining the same element will throw.
