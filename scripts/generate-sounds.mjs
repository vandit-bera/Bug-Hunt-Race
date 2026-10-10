// Synthesizes the game's sound effects as small mono WAV files in public/sounds.
// The sounds are generated from sine/square tones here, so they are original
// work released under CC0 (see public/sounds/LICENSE.md). Run: node scripts/generate-sounds.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 22050;
const OUT = new URL("../public/sounds/", import.meta.url);

/** One note: frequency in Hz (a number, or [from, to] for a slide) over `start`..`start + length` seconds. */
function render(totalSec, notes) {
  const samples = new Float32Array(Math.round(totalSec * RATE));
  for (const { freq, start, length, shape = "sine", gain = 0.5 } of notes) {
    const [f0, f1] = Array.isArray(freq) ? freq : [freq, freq];
    const first = Math.round(start * RATE);
    const count = Math.round(length * RATE);
    let phase = 0;
    for (let i = 0; i < count && first + i < samples.length; i++) {
      const t = i / count;
      phase += (2 * Math.PI * (f0 + (f1 - f0) * t)) / RATE;
      const wave =
        shape === "square" ? Math.sign(Math.sin(phase)) * 0.6 : Math.sin(phase);
      const attack = Math.min(1, i / (0.005 * RATE));
      const envelope = attack * (1 - t) ** 1.5;
      samples[first + i] += wave * envelope * gain;
    }
  }
  return samples;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, i) => {
    const clamped = Math.max(-1, Math.min(1, value));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const SOUNDS = {
  tick: render(0.1, [{ freq: 660, start: 0, length: 0.1, gain: 0.6 }]),
  go: render(0.4, [
    { freq: 880, start: 0, length: 0.15 },
    { freq: 1320, start: 0.12, length: 0.28 },
  ]),
  pass: render(0.3, [
    { freq: 660, start: 0, length: 0.12 },
    { freq: 880, start: 0.1, length: 0.2 },
  ]),
  fail: render(0.35, [
    { freq: [220, 150], start: 0, length: 0.35, shape: "square", gain: 0.35 },
  ]),
  solved: render(0.8, [
    { freq: 523, start: 0, length: 0.15 },
    { freq: 659, start: 0.13, length: 0.15 },
    { freq: 784, start: 0.26, length: 0.15 },
    { freq: 1047, start: 0.39, length: 0.41 },
  ]),
  timeup: render(0.7, [
    { freq: 440, start: 0, length: 0.2, shape: "square", gain: 0.3 },
    { freq: 330, start: 0.2, length: 0.2, shape: "square", gain: 0.3 },
    { freq: [262, 130], start: 0.4, length: 0.3, shape: "square", gain: 0.3 },
  ]),
  react: render(0.09, [
    { freq: [700, 1100], start: 0, length: 0.09, gain: 0.25 },
  ]),
  fanfare: render(1.6, [
    { freq: 523, start: 0, length: 0.14 },
    { freq: 523, start: 0.15, length: 0.14 },
    { freq: 523, start: 0.3, length: 0.14 },
    { freq: 659, start: 0.45, length: 0.4 },
    { freq: 587, start: 0.85, length: 0.14 },
    { freq: 659, start: 1.0, length: 0.14 },
    { freq: 784, start: 1.15, length: 0.45 },
    { freq: 392, start: 1.15, length: 0.45, shape: "square", gain: 0.2 },
  ]),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  writeFileSync(new URL(`${name}.wav`, OUT), toWav(samples));
}
