# Saccadic

> Speed reading, your way. Paste any text and read it one word at a time at your own pace.

Saccadic is a minimal RSVP (Rapid Serial Visual Presentation) reader. It shows one word at a time, fixed at your eye's natural focal point, so your eyes stop moving and the words stream past instead. Spritz-style "Word Runner" reading.

No accounts and no server-side storage — everything you read or save stays in your browser's `localStorage`. The page does load Google Analytics for traffic stats.

## Run it

There is no build step. Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Features

- **Paste mode** — drop in any text, hit play
- **Speak mode** — read aloud or dictate, the words stream as you talk (Chrome / Edge / Safari, via Web Speech API)
- **ORP (Optimal Recognition Point)** — focal letter highlighted, with vertical guide and horizontal lines so your eye doesn't drift
- **Customizable highlight color** — pick any color; persists across sessions
- **WPM 150 → 500** — start at 8th-grade reading pace, work up to trained-speed-reader territory
- **Saved books** — keep texts in `localStorage` with auto-bookmarking; resume where you left off
- **Themes** — dark, light, high contrast, deuteranopia-friendly; extensible (see `src/themes/themes.js`)
- **Mobile-friendly** — touch targets, 2×2 button grid on small screens, no pull-to-refresh hijack

## Keyboard shortcuts

| Key     | Action          |
|---------|-----------------|
| `Space` | Play / Pause    |
| `Z`     | Speed up (+25)  |
| `X`     | Slow down (-25) |

## Tech stack

- Vanilla JavaScript (no frameworks)
- [Lit](https://lit.dev/) for web components (loaded from CDN — no bundler)
- CSS custom properties for theming
- Web Speech API for dictation
- `localStorage` for persistence

## Architecture

```
index.html                       — single entry, theme/orp pre-paint script
src/
  components/
    saccadic-app.js              — root component, state owner
    orp-display.js               — one-word RSVP display with ORP guides
    saccadic-controls.js         — paste/listen toggle, WPM slider, theme + color
    saved-books-panel.js         — side-drawer book list with delete-confirm
  utils/
    reader.js                    — RSVP timing loop, keyboard shortcuts
    orp.js                       — ORP letter calculation, tokenizer
    speech.js                    — Web Speech API wrapper
    store.js                     — localStorage book CRUD
  themes/
    themes.js                    — theme tokens + manager with custom-color override
```

## Contributing

See [AGENTS.md](./AGENTS.md) for the project brief used by AI agents working on this codebase.

## License

MIT — see [LICENSE](./LICENSE).
