let access, output;
let onCC = () => {}, onPorts = () => {};
const sounding = new Map();

export async function initMidi(ports, cc) {
  onPorts = ports;
  onCC = cc;
  if (!navigator.requestMIDIAccess) throw new Error('Web MIDI is unavailable in this browser');
  access = await navigator.requestMIDIAccess();
  access.onstatechange = refresh;
  refresh();
}
function refresh() {
  const outputs = [...access.outputs.values()].filter(p => p.state === 'connected');
  if (!outputs.includes(output)) { panic(); output = outputs[0] || null; }
  for (const input of access.inputs.values()) {
    input.onmidimessage = ({ data }) => {
      if ((data[0] & 0xf0) === 0xb0 && data.length >= 3) {
        onCC({ port: input.id, channel: (data[0] & 15) + 1, cc: data[1], value: data[2] });
      }
    };
  }
  onPorts(outputs, output?.id, [...access.inputs.values()].filter(p => p.state === 'connected').length);
}
export function selectOutput(id) {
  panic(); output = access?.outputs.get(id) || null;
}
export function sendNoteOn(note, velocity, channel) {
  if (!output || output.state !== 'connected') return;
  const key = `${channel}:${note}`;
  if (sounding.has(key)) sendNoteOff(note, channel);
  output.send([0x90 | (channel - 1), note, velocity]);
  sounding.set(key, { note, channel, output });
}
export function sendNoteOff(note, channel) {
  const key = `${channel}:${note}`;
  const entry = sounding.get(key);
  if (entry?.output.state === 'connected') entry.output.send([0x80 | (channel - 1), note, 0]);
  sounding.delete(key);
}
export function panic() {
  for (const { note, channel } of [...sounding.values()]) sendNoteOff(note, channel);
}
