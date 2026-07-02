# Ocular Sequencer

![ocular logo](public/ocular.svg)

A webcam‑based MIDI sequencer inspired by looking through a microscope ocular.
Point a camera at anything — a petri dish, a circuit board, your eye — and the
rotating radar line triggers MIDI notes when it passes over bright or dark areas.

## How it works

1. Your webcam feed appears inside a circular viewport (the "ocular").
2. A thin radar line rotates clockwise at a BPM you control.
3. Sample points sit along the line — one per scale degree.
4. When a point's pixel brightness crosses your threshold, a MIDI note fires.
5. Choose a scale, a root note, a spread curve, and up to 127 voices.

| Control | What it does |
|---------|-------------|
| **mode** | `bright` triggers on light areas, `dark` on shadows |
| **trigger** | `gate` plays while over the blob, `hold` sustains until the next trigger |
| **scale** | 15 scales (Chromatic, Major, Minor, Pentatonic, Blues, Dorian, etc.) |
| **root** | note + octave (C1–B7) |
| **voices** | 1–127 sample rings |
| **spread** | distribution curve — cluster notes toward the center or the rim |
| **threshold** | brightness cutoff (0–255) |
| **speed** | rotation in BPM |

Double‑click any slider to reset it.

## MIDI setup

Ocular Sequencer uses the **Web MIDI API**, which is currently only supported in
Chromium‑based browsers (Chrome, Edge, Opera, Arc). Firefox and Safari do not
support Web MIDI.

### macOS

1. Open **Audio MIDI Setup** (`/Applications/Utilities/`).
2. Choose **Window → Show MIDI Studio**.
3. Double‑click **IAC Driver** and enable **Device is online**.
4. Add a port (e.g. "Ocular Sequencer").
5. In your DAW or synth, select the IAC port as a MIDI input.
6. In Chrome, the IAC port will appear automatically.

### Windows

1. Install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html).
2. Create a new virtual port (e.g. "Ocular Seq").
3. In your DAW, select that port as a MIDI input.
4. Chrome will detect the virtual port.

### Linux

1. Load the `snd-virmidi` kernel module:
   ```bash
   sudo modprobe snd-virmidi
   ```
2. Virtual MIDI ports will appear in Chrome and your DAW.
3. Alternatively, use `aconnect` to route between ports.

### Sending MIDI to hardware

If you have a physical synth connected via USB, Chrome will list it directly.
Select your device's port from any DAW or MIDI router.

---

## Community

- [Biosonification Study Group](https://bioclub.tokyo/en/events/biosonics/) — Tokyo Biolab

## Credits

Built by [pitscher.net](https://pitscher.net) with coding agents from [opencode.ai](https://opencode.ai).
