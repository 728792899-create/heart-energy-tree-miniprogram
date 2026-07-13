const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 22050;
const OUTPUT_DIR = path.resolve(__dirname, '../miniprogram/assets/sounds');

const cues = [
  {
    name: 'heart-chime.wav',
    duration: 0.56,
    notes: [
      { start: 0, duration: 0.28, frequency: 659.25, volume: 0.42 },
      { start: 0.18, duration: 0.36, frequency: 783.99, volume: 0.34 }
    ]
  },
  {
    name: 'milestone-bloom.wav',
    duration: 0.78,
    notes: [
      { start: 0, duration: 0.34, frequency: 523.25, volume: 0.3 },
      { start: 0.14, duration: 0.4, frequency: 659.25, volume: 0.32 },
      { start: 0.29, duration: 0.46, frequency: 783.99, volume: 0.34 }
    ]
  },
  {
    name: 'promise-bell.wav',
    duration: 0.66,
    notes: [
      { start: 0, duration: 0.43, frequency: 587.33, volume: 0.31 },
      { start: 0.2, duration: 0.43, frequency: 880, volume: 0.32 }
    ]
  }
];

function envelope(localTime, duration) {
  const attack = Math.min(0.035, duration * 0.18);
  const release = Math.min(0.24, duration * 0.58);
  if (localTime < attack) return localTime / attack;
  if (localTime > duration - release) return Math.max(0, (duration - localTime) / release);
  return 1;
}

function sampleNote(note, time) {
  const localTime = time - note.start;
  if (localTime < 0 || localTime > note.duration) return 0;
  const decay = Math.exp(-2.6 * localTime / note.duration);
  const fundamental = Math.sin(2 * Math.PI * note.frequency * localTime);
  const shimmer = Math.sin(2 * Math.PI * note.frequency * 2.01 * localTime) * 0.24;
  return (fundamental + shimmer) * envelope(localTime, note.duration) * decay * note.volume;
}

function renderCue(cue) {
  const sampleCount = Math.floor(cue.duration * SAMPLE_RATE);
  const pcm = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const mixed = cue.notes.reduce((total, note) => total + sampleNote(note, time), 0);
    const softened = Math.tanh(mixed * 1.12) * 0.82;
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, softened)) * 32767), index * 2);
  }

  const output = Buffer.alloc(44 + pcm.length);
  output.write('RIFF', 0);
  output.writeUInt32LE(36 + pcm.length, 4);
  output.write('WAVE', 8);
  output.write('fmt ', 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36);
  output.writeUInt32LE(pcm.length, 40);
  pcm.copy(output, 44);
  return output;
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
cues.forEach((cue) => {
  fs.writeFileSync(path.join(OUTPUT_DIR, cue.name), renderCue(cue));
});
