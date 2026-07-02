# CLAUDE.md — Ocular Sequencer

## Concept
Microscope‑ocular inspired webcam MIDI sequencer. Camera feed is rendered inside
a circular viewport. A rotating radar line scans the image. Sample points along
the line trigger MIDI notes when their pixel brightness crosses a threshold.

## Tech stack
- **p5.js** — canvas rendering, webcam capture, pixel sampling
- **Web MIDI API** — MIDI output (Chrome only)
- **Vite** — dev server and bundler
- **Bun** — package manager (preferred, npm works too)
- **Vanilla JS (ES modules)** — no framework

## Visual language
- **Palette**: grayscale `#0a0a0a` → `#fff`, dark background `#0a0a0a`
- **Typography**: JetBrains Mono (monospace), 10–11px, lowercase labels
- **Shapes**: p5 primitives only — `circle()`, `quad()` for diamonds
- **Sample points**: filled diamond (triggered), small diamond (approaching), tiny circle (inactive)
- **Note labels**: dark pill background behind text for contrast
- **Circle**: 80% of min(width, height), clipped on main canvas for hard edge
- **UI panel**: right side, collapsible, flat borders, no shadows or blur

## Architecture
```
src/
  main.js       — entry: DOM wiring, dropdown populating, slider binding, piano-roll renderer
  state.js      — DEFAULTS + live state object + derived helpers (getRootMidi, applyCurve, getNoteForRing)
  midi.js       — Web MIDI init, sendNoteOn/Off, channel-aware
  detection.js  — isOverThreshold (hysteresis), proximityToThreshold
  scales.js     — 15 scale definitions, extendIntervals, midiToNoteName
  sketch.js     — p5 sketch: setup, draw loop, angle step, MIDI state machine
  draw.js       — drawSamplePoint (diamond/circle primitives), drawRadarLine
  style.css     — monospace, flat, collapsible panel, mobile responsive
```

## Key behaviors
- **Hysteresis** (±15 brightness units) prevents rapid on/off toggling
- **Min‑hold** (100ms) debounces triggers
- **Spread curve**: `t^k` where `k = 2^(-curve * 2)`, curve ∈ [-1, 1]
- **MIDI channel**: configurable 1–16, encoded in status byte
- **Piano roll**: top‑left HTML element grouping simultaneous notes within 50ms
- **Legend**: bottom‑left HTML element showing glyph colors + current readings

## State defaults
| Key | Default |
|-----|---------|
| threshold | 200 |
| mode | bright |
| holdNotes | false |
| scale | Chromatic |
| rootNote / rootOctave | 0 / 3 (C3) |
| voices | 12 |
| curve | 0 (linear) |
| imgBrightness | 100 |
| imgSaturation | 0 |
| imgContrast | 150 |
| speedBpm | 120 |
| midiChannel | 1 |

## Running
```bash
bun install
bun run dev
```

## Commands
- `bun install` — install dependencies
- `bun run dev` — start Vite dev server
- `bun run build` — production build
