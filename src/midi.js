// ─── Web MIDI ────────────────────────────────────────────────────────────────
// Handles MIDI access, port discovery, and note-on/off sending.

let midiOutputs = [];
let currentOutput = null;

/**
 * Request MIDI access and select the first available output.
 * @param {HTMLElement} statusEl — DOM element to display connection status
 * @returns {Promise<object|null>} the selected MIDI output, or null
 */
export async function initMidi(statusEl) {
  try {
    const midiAccess = await navigator.requestMIDIAccess();

    for (const output of midiAccess.outputs.values()) {
      midiOutputs.push(output);
    }

    if (midiOutputs.length > 0) {
      currentOutput = midiOutputs[0];
      statusEl.textContent = `midi: ${currentOutput.name}`;
      statusEl.classList.add('connected');
    } else {
      statusEl.textContent = 'midi: no outputs found';
    }

    midiAccess.onstatechange = (e) => {
      console.log(e.port.name, e.port.manufacturer, e.port.state);
    };

    return currentOutput;
  } catch (err) {
    console.warn('MIDI unavailable:', err);
    statusEl.textContent = 'midi: access denied';
    return null;
  }
}

/** Send a MIDI Note On message. */
export function sendNoteOn(note, velocity = 100) {
  if (!currentOutput) return;
  currentOutput.send([0x90, note, velocity]);
}

/** Send a MIDI Note Off message. */
export function sendNoteOff(note) {
  if (!currentOutput) return;
  currentOutput.send([0x80, note, 0]);
}

/** Return the currently active MIDI output (may be null). */
export function getOutput() {
  return currentOutput;
}
