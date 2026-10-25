# Ocular Sequencer

![ocular logo](public/ocular.svg)

A webcam‑based MIDI sequencer inspired by looking through a microscope ocular.
Point a camera at anything — a petri dish, a circuit board, your eye — and the
rotating radar line triggers MIDI notes when it passes over bright or dark areas.

## How it works

The webcam stays in color. One sweep is one 4/4 bar. The MIDI-assignable
**division** slider selects **off → 1/4 → 1/8 → 1/16 → 1/32 → 1/64**.
With steps off, the scan triggers on entry and releases on exit, with a 100ms
minimum hold. Rhythmic modes sample at the chosen division. Each point plays a successive note in the chosen scale when
its intensity is inside the selected range.

| Control | What it does |
|---------|-------------|
| Light / dark / edges | Play highlights, shadows, or local contrast boundaries |
| Division | Off (continuous scan), quarter, eighth, sixteenth, thirty-second, or sixty-fourth notes; MIDI learn supported |
| Edge gain | Amplify faint boundaries (1–8×), visible in edges mode |
| Range from / to | Select an inclusive intensity band from 0–100%; darkness 70–100% selects deep shadows |
| Tempo | 30–240 BPM; four beats per revolution |
| Rhythmic density | Evenly distribute pulses; applies only to rhythmic divisions |
| Image level | Dim the displayed image without changing detection |
| Note length | Duration as 10–95% of a rhythmic step; hidden when steps are off |
| Dynamics | Blend fixed velocity 100 with intensity-driven velocity 35–127 |
| Scale / root | Choose harmony; defaults to C3 minor pentatonic |
| Notes | 1–16 sampling points, ascending through the scale |
| Spatial spread | Move points toward the center or rim without changing pitch |

A small diamond remains at the point where a zone first triggered, then fades
after leaving it. Sustained zones retrigger on rhythmic steps without painting
trails over the camera. Detection has a 3% release margin to reduce flicker.
Double-click any slider to reset it. Pause or **all notes off** stops notes;
switching away from the tab pauses playback too.

## Microscope performance

The main panel keeps image source, strength range, division, scan tempo, and
rhythmic note length within reach. Harmony/expression, view, and MIDI routing
are folded away. Presets live under harmony/expression.

Click **edges** or press **E** to detect structure boundaries rather than overall
illumination. Edge gain makes faint structures more sensitive; use the strength
range to reject weak noise. This uses a local Sobel gradient at each sample point
(two-pixel spacing), keeping the color view intact and avoiding a full-frame
image-processing pass. It is a contrast detector, not object recognition; focus,
illumination changes, and camera noise can still affect triggering.

## Performance tools

- **Freeze scene** holds one color camera frame so the same image repeats each bar.
- **Restart bar** returns the scan to twelve o’clock and releases sounding notes.
- **Drift**, **pulse**, and **shadows** presets provide starting points for sparse,
  syncopated, and shadow-driven playing. They preserve your root, MIDI settings,
  controller mappings, and viewing preferences.
- **Space** toggles playback, **F** freezes/unfreezes, and **R** restarts. Shortcuts
  stay inactive while using a form control or reading the info modal.
- The radar rim shows enabled steps, rests, quarter-note beats, and scan position.
  Note labels are off by default; enable them under **view**.
- The radar sits beside desktop controls and above the compact mobile panel.
  Collapsing controls expands the viewing area.

## MIDI setup

Use a browser with Web MIDI support and allow MIDI access. Choose a note output
and channel under **midi routing**, then route that port to a DAW or
hardware instrument. The app itself does not generate audio.

Enable **midi map** to reveal a **learn** button beside every slider, including
division and edge gain. Click learn, then move an absolute MIDI CC knob
or fader (0–127). The mapping includes the controller input, channel, and CC,
and is saved in this browser. Click again or press Escape to cancel learning.
Learning the same knob for another slider moves its assignment. **Clear mappings**
removes all assignments. Inputs and outputs update when devices connect/disconnect.
Relative encoders, MIDI clock sync, and channel-mode CCs (120–127) are not mapped.

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
Select your device's port in the app's MIDI output menu.

---

## Community

- [Biosonification Study Group](https://bioclub.tokyo/en/events/biosonics/) — Tokyo Biolab

## Credits

Built by [pitscher.net](https://pitscher.net) with coding agents from [opencode.ai](https://opencode.ai).

## Development

Run `bun install`, then `bun run dev`. Use `bun run build` for production and
`bun test` for detection, pitch mapping, and MIDI lifecycle checks.
