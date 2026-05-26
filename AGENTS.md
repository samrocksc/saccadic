# Saccadic — Project Agent Brief

## Overview
RSVP (Rapid Serial Visual Presentation) saccadic reading app. One word at a time with ORP (Optimal Recognition Point) vertical line indicators. Kindle "Word Runner" style.

## Tech Stack
- Vanilla JS + Lit-HTML (no build step)
- Web Components (LitElement)
- CSS custom properties for theming
- No frameworks, no bundlers

## Design
- Mobile-first, responsive
- Dark/light theme (system default detection)
- Extensible theme system (colorblind-friendly options)
- Single HTML file with module imports

## Features
1. **MVP**: Copy/paste text → WPM slider → ORP saccadic display
2. Keyboard shortcuts: z (speed up), x (speed down), space (pause)
3. Mobile: buttons below display to speed up/slow down
4. Listen & transcribe via Web Speech API
5. Theme system (dark/light + user themes)

## ORP Display Spec
- One word centered at a time
- Horizontal line above the word, horizontal line below
- Vertical line pointing to the ORP letter (the optimal recognition point — typically 1/3 into the word)
- The ORP letter highlighted in accent color (default red, customizable per theme)
- ORP calculation: left-of-center letter for even-length words

## WPM Range
- Min: 150 WPM (8th grade reading baseline)
- Max: 500 WPM (trained speed-reader cap)
- Default: 150 WPM
- Step (z/x keyboard): 25 WPM

## Files
- `index.html` — main entry
- `src/components/` — LitElement web components
- `src/themes/` — theme CSS files
- `src/utils/` — ORP calculation, timing, etc.

## GitHub
- Owner: samrocksc
- Repo: https://github.com/samrocksc/saccadic
- Use `gh` CLI with `GH_CONFIG_DIR=/home/sam/.config/gh`
