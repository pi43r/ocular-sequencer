// ─── Web MIDI ────────────────────────────────────────────────────────────────

import { state } from "./state.js";

let midiOutputs = [];
let currentOutput = null;

export async function initMidi(statusEl) {
  try {
    const midiAccess = await navigator.requestMIDIAccess();
    for (const output of midiAccess.outputs.values()) {
      midiOutputs.push(output);
    }

    if (midiOutputs.length > 0) {
      currentOutput = midiOutputs[0];
      statusEl.textContent = `midi ch${state.midiChannel} · ${currentOutput.name}`;
      statusEl.classList.add("connected");
    } else {
      statusEl.textContent = "midi: no outputs found";
    }

    midiAccess.onstatechange = (e) => {
      console.log(e.port.name, e.port.manufacturer, e.port.state);
    };

    return currentOutput;
  } catch (err) {
    console.warn("MIDI unavailable:", err);
    statusEl.textContent = "midi: access denied";
    return null;
  }
}

/** Send a MIDI Note On message on the configured channel (1–16). */
export function sendNoteOn(note, velocity = 100) {
  if (!currentOutput) return;
  const channel = state.midiChannel - 1; // 0-indexed nibble
  currentOutput.send([0x90 | channel, note, velocity]);
}

/** Send a MIDI Note Off message on the configured channel (1–16). */
export function sendNoteOff(note) {
  if (!currentOutput) return;
  const channel = state.midiChannel - 1;
  currentOutput.send([0x80 | channel, note, 0]);
}

export function getOutput() {
  return currentOutput;
}
