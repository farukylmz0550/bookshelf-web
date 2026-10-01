#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * v2.7.0 — Annual-summary background music renderer (dev-time, one-shot).
 * 2026-10-01 — rewritten per user rules: Western instrument voices (piano /
 * harp / violin / guitar, per piece), an old/vintage treatment (tape warmth,
 * wow & flutter, faint hiss), ~60 s performances (theme repeats + second-half
 * reprises), and the 6-tier goal-progress mood ladder (sad → hopeful →
 * neutral → happy → happier → celebration; see src/lib/annual-music.ts).
 *
 * Renders the predetermined public-domain pieces to WAV using a simple
 * offline synth (lead + bass, ADSR envelope, light reverb), then encodes to
 * MP3 with ffmpeg. The note transcriptions come from public-domain scores
 * (all composers died more than 70 years ago); the rendered performances are
 * dedicated to the public domain via CC0 1.0 (LICENSE-CC0).
 *
 * Usage:
 *   node scripts/render-annual-audio.mjs            # WAV files to /tmp
 *   node scripts/render-annual-audio.mjs --encode   # + ffmpeg MP3 into public/audio/annual
 *
 * MP3 metadata (ID3) — artist: farukylmz0505, license: CC0 1.0.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = "public/audio/annual";

// Note name → MIDI number
const NOTE = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};
function midi(name) {
  const m = name.match(/^([A-G][#b]?)(\d)$/);
  if (!m) throw new Error(`bad note ${name}`);
  return (Number(m[2]) + 1) * 12 + NOTE[m[1]];
}

const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ---------------------------------------------------------------------------
// Instrument voices (user rule, 2026-10-01 — the repertoire is Western music,
// so the synth voices Western instruments: piano, harp, violin, guitar) with
// an old, vintage character (applied in vintage() below).
//
// partials: [harmonicRatio, gain] pairs above the fundamental (slightly
// inharmonic where noted). decay: exponential decay rate (1/s) of the struck/
// plucked voices; 0 = bowed/sustained. vibrato: bowed voices only.
// ---------------------------------------------------------------------------
const INSTRUMENTS = {
  piano: {
    attack: 0.006,
    release: 0.08,
    decay: 2.0,
    partials: [
      [1, 1],
      [2, 0.45],
      [3, 0.18],
      [4.005, 0.08],
    ],
  },
  harp: {
    attack: 0.003,
    release: 0.1,
    decay: 1.5,
    partials: [
      [1, 1],
      [2, 0.35],
      [3, 0.12],
    ],
  },
  guitar: {
    attack: 0.004,
    release: 0.09,
    decay: 2.6,
    partials: [
      [1, 1],
      [2, 0.4],
      [3, 0.2],
      [4.002, 0.07],
    ],
  },
  violin: {
    attack: 0.05,
    release: 0.12,
    decay: 0, // bowed: sustained
    partials: [
      [1, 1],
      [2, 0.4],
      [3, 0.22],
      [4, 0.1],
    ],
    vibrato: { rate: 5.6, cents: 18, onset: 0.25 }, // enters a quarter into the note
  },
};

// Warm cello-ish bass voice for all pieces (Western instrument per the same
// rule — the low line of a small old ensemble).
const BASS_VOICE = {
  attack: 0.03,
  release: 0.1,
  decay: 0,
  partials: [
    [1, 1],
    [2, 0.22],
    [3, 0.06],
  ],
};

/**
 * A piece = melody + bass lines. Each note: ["<Note>", beats] — beat = 1
 * quarter note at the piece tempo. Rest = ["-", beats].
 */
const PIECES = [
  {
    slug: "chopin-nocturne-op9-no2",
    composerDied: 1849,
    title: "Nocturne in E-flat major, Op. 9 No. 2",
    composer: "Frédéric Chopin",
    instrument: "piano",
    tempo: 66, // andante
    melody: [
      ["-", 1],
      ["Bb4", 1.5],
      ["G4", 0.5],
      ["Eb5", 1],
      ["D5", 0.5],
      ["C5", 0.5],
      ["Bb4", 1],
      ["G4", 1],
      ["F4", 0.5],
      ["G4", 0.5],
      ["Bb4", 1.5],
      ["-", 0.5],
      ["C5", 1],
      ["Bb4", 0.5],
      ["G4", 0.5],
      ["F4", 2],
      ["-", 1],
      ["Bb4", 1.5],
      ["C5", 0.5],
      ["D5", 1],
      ["Eb5", 1],
      ["F5", 0.5],
      ["Eb5", 0.5],
      ["D5", 1],
      ["C5", 2],
    ],
    bass: [
      ["-", 2],
      ["Eb3", 1],
      ["Bb3", 1],
      ["-", 2],
      ["Eb3", 1],
      ["Bb3", 1],
      ["-", 2],
      ["Eb3", 1],
      ["Bb3", 1],
      ["-", 2],
      ["Eb3", 1],
      ["Bb3", 1],
      ["-", 2],
      ["Ab3", 1],
      ["Eb3", 1],
      ["-", 2],
      ["Bb3", 1],
      ["F3", 1],
    ],
  },
  {
    slug: "beethoven-moonlight-sonata-i",
    composerDied: 1827,
    title: "Piano Sonata No. 14 'Moonlight', I. Adagio sostenuto",
    composer: "Ludwig van Beethoven",
    instrument: "piano",
    tempo: 54,
    // Arpeggio triplet figure (simplified) + dotted-rhythm upper voice
    melody: [
      ["-", 1],
      ["G#4", 0.75],
      ["C#5", 0.25],
      ["E5", 0.75],
      ["C#5", 0.25],
      ["G#4", 1.5],
      ["-", 0.5],
      ["G#4", 0.75],
      ["C#5", 0.25],
      ["E5", 0.75],
      ["C#5", 0.25],
      ["G#4", 1.5],
      ["-", 0.5],
      ["A4", 0.75],
      ["C5", 0.25],
      ["E5", 0.75],
      ["C5", 0.25],
      ["A4", 1.5],
      ["-", 0.5],
      ["F#4", 0.75],
      ["A#4", 0.25],
      ["C#5", 0.75],
      ["A#4", 0.25],
      ["F#4", 1.5],
    ],
    bass: [
      ["C#3", 4],
      ["-", 2],
      ["C#3", 4],
      ["-", 2],
      ["A2", 4],
      ["-", 2],
      ["F#2", 4],
      ["-", 2],
    ],
  },
  {
    slug: "petzold-minuet-in-g",
    composerDied: 1750,
    title: "Minuet in G major, BWV Anh. 114",
    composer: "Christian Petzold (attr. J. S. Bach)",
    instrument: "guitar",
    tempo: 126,
    melody: [
      ["D5", 1],
      ["G4", 0.5],
      ["A4", 0.5],
      ["B4", 0.5],
      ["C5", 0.5],
      ["D5", 1],
      ["G4", 1],
      ["G4", 1],
      ["E5", 0.5],
      ["C5", 0.5],
      ["D5", 0.5],
      ["E5", 0.5],
      ["B4", 1],
      ["G4", 1],
      ["C5", 1],
      ["D5", 0.5],
      ["C5", 0.5],
      ["B4", 0.5],
      ["A4", 0.5],
      ["B4", 1],
      ["G4", 1],
      ["A4", 0.5],
      ["B4", 0.5],
      ["C5", 0.5],
      ["D5", 0.5],
      ["E5", 1],
      ["F#5", 1],
      ["G5", 2],
    ],
    bass: [
      ["G3", 2],
      ["-", 2],
      ["C3", 2],
      ["-", 2],
      ["E3", 2],
      ["-", 2],
      ["G3", 2],
      ["D3", 2],
    ],
  },
  {
    slug: "beethoven-fur-elise",
    composerDied: 1827,
    title: "Für Elise, WoO 59",
    composer: "Ludwig van Beethoven",
    instrument: "piano",
    tempo: 120,
    melody: [
      ["E5", 0.5],
      ["D#5", 0.5],
      ["E5", 0.5],
      ["D#5", 0.5],
      ["E5", 0.5],
      ["B4", 0.5],
      ["D5", 0.5],
      ["C5", 0.5],
      ["A4", 1],
      ["-", 0.5],
      ["C4", 0.5],
      ["E4", 0.5],
      ["A4", 0.5],
      ["B4", 1],
      ["-", 0.5],
      ["E4", 0.5],
      ["G#4", 0.5],
      ["B4", 0.5],
      ["C5", 1],
      ["-", 0.5],
      ["E4", 0.5],
      ["E5", 0.5],
      ["D#5", 0.5],
    ],
    bass: [
      ["-", 4],
      ["-", 4],
      ["A2", 2],
      ["E3", 2],
      ["E2", 2],
      ["E3", 2],
      ["A2", 2],
      ["E3", 2],
    ],
  },
  {
    slug: "mozart-eine-kleine-nachtmusik",
    composerDied: 1791,
    title: "Eine kleine Nachtmusik, K. 525 (Allegro)",
    composer: "Wolfgang Amadeus Mozart",
    instrument: "violin",
    tempo: 132,
    melody: [
      ["G4", 0.25],
      ["-", 0.25],
      ["D4", 0.25],
      ["-", 0.25],
      ["G4", 0.25],
      ["-", 0.25],
      ["D4", 0.25],
      ["-", 0.25],
      ["G4", 0.25],
      ["D4", 0.25],
      ["G4", 0.25],
      ["B4", 0.25],
      ["D5", 2],
      ["C5", 0.25],
      ["-", 0.25],
      ["A4", 0.25],
      ["-", 0.25],
      ["C5", 0.25],
      ["-", 0.25],
      ["A4", 0.25],
      ["-", 0.25],
      ["C5", 0.25],
      ["A4", 0.25],
      ["C5", 0.25],
      ["F#5", 0.25],
      ["A5", 2],
      ["-", 0.5],
      ["A4", 0.25],
      ["-", 0.25],
      ["F#4", 0.25],
      ["-", 0.25],
      ["A4", 0.25],
      ["-", 0.25],
      ["F#4", 0.25],
      ["-", 0.25],
      ["A4", 0.25],
      ["D5", 0.25],
      ["F#5", 0.25],
      ["A5", 2],
    ],
    bass: [
      ["G3", 2],
      ["-", 2],
      ["G3", 1],
      ["G2", 1],
      ["D3", 2],
      ["A3", 2],
      ["-", 2],
      ["A3", 1],
      ["A2", 1],
      ["D3", 2],
    ],
  },
  {
    slug: "mozart-rondo-alla-turca",
    composerDied: 1791,
    title: "Rondo alla Turca (Piano Sonata No. 11, K. 331)",
    composer: "Wolfgang Amadeus Mozart",
    instrument: "piano",
    tempo: 126,
    melody: [
      ["B4", 0.25],
      ["A4", 0.25],
      ["G#4", 0.25],
      ["A4", 0.25],
      ["C5", 0.5],
      ["-", 0.25],
      ["D5", 0.25],
      ["C5", 0.25],
      ["B4", 0.25],
      ["C5", 0.25],
      ["-", 0.25],
      ["E5", 0.5],
      ["-", 0.25],
      ["F5", 0.25],
      ["E5", 0.25],
      ["D#5", 0.25],
      ["E5", 0.25],
      ["B5", 0.5],
      ["-", 0.25],
      ["E5", 0.25],
      ["D#5", 0.25],
      ["E5", 0.25],
      ["D#5", 0.25],
      ["E5", 0.25],
      ["B5", 0.5],
      ["A5", 0.5],
    ],
    bass: [
      ["A2", 1],
      ["E3", 1],
      ["A3", 2],
      ["A2", 1],
      ["E3", 1],
      ["A3", 2],
      ["C3", 1],
      ["G3", 1],
      ["C4", 2],
      ["A2", 1],
      ["E3", 1],
      ["A3", 2],
    ],
  },
  {
    slug: "vivaldi-spring-allegro",
    composerDied: 1741,
    title: "La Primavera (The Four Seasons), I. Allegro",
    composer: "Antonio Vivaldi",
    instrument: "violin",
    tempo: 138,
    melody: [
      ["E5", 0.5],
      ["E5", 0.5],
      ["E5", 0.5],
      ["-", 0.5],
      ["D5", 0.5],
      ["C5", 0.5],
      ["B4", 1],
      ["-", 0.5],
      ["G5", 0.5],
      ["-", 0.5],
      ["G5", 0.5],
      ["-", 0.5],
      ["F#5", 0.5],
      ["E5", 0.5],
      ["-", 1.5],
      ["E5", 0.5],
      ["E5", 0.5],
      ["E5", 0.5],
      ["-", 0.5],
      ["D5", 0.5],
      ["D5", 0.5],
      ["C5", 1],
      ["-", 0.5],
      ["A5", 0.5],
      ["-", 0.5],
      ["A5", 0.5],
      ["-", 0.5],
      ["G5", 0.5],
      ["F#5", 1.5],
    ],
    bass: [
      ["E3", 1],
      ["E3", 1],
      ["E3", 1],
      ["E3", 1],
      ["C3", 1],
      ["C3", 1],
      ["C3", 1],
      ["C3", 1],
      ["E3", 1],
      ["E3", 1],
      ["E3", 1],
      ["E3", 1],
      ["A3", 1],
      ["A3", 1],
      ["A3", 1],
      ["A3", 1],
    ],
  },
  {
    slug: "tchaikovsky-swan-lake-theme",
    composerDied: 1893,
    title: "Swan Lake, Op. 20 (Theme)",
    composer: "Pyotr Ilyich Tchaikovsky",
    instrument: "harp",
    tempo: 76,
    melody: [
      ["-", 1],
      ["F#4", 0.5],
      ["B4", 1],
      ["C#5", 0.5],
      ["D5", 1.5],
      ["C#5", 0.5],
      ["B4", 1],
      ["F#4", 0.5],
      ["B4", 1.5],
      ["F#5", 1],
      ["F#5", 0.5],
      ["F#5", 0.5],
      ["A5", 1],
      ["G5", 2],
      ["-", 0.5],
      ["F#5", 0.5],
      ["F#5", 0.5],
      ["E5", 1],
      ["D5", 1],
      ["C#5", 1],
      ["B4", 2],
    ],
    bass: [
      ["-", 2],
      ["B2", 2],
      ["-", 2],
      ["B2", 2],
      ["-", 2],
      ["E3", 2],
      ["-", 2],
      ["F#2", 2],
      ["-", 2],
      ["B2", 2],
    ],
  },
  {
    slug: "beethoven-ode-to-joy",
    composerDied: 1827,
    title: "Ode to Joy (Symphony No. 9, Op. 125)",
    composer: "Ludwig van Beethoven",
    instrument: "violin",
    tempo: 120,
    melody: [
      ["F#5", 1],
      ["F#5", 1],
      ["G5", 1],
      ["A5", 1],
      ["A5", 1],
      ["G5", 1],
      ["F#5", 1],
      ["E5", 1],
      ["D5", 1],
      ["D5", 1],
      ["E5", 1],
      ["F#5", 1],
      ["F#5", 1.5],
      ["E5", 0.5],
      ["E5", 2],
      ["F#5", 1],
      ["F#5", 1],
      ["G5", 1],
      ["A5", 1],
      ["A5", 1],
      ["G5", 1],
      ["F#5", 1],
      ["E5", 1],
      ["D5", 1],
      ["D5", 1],
      ["E5", 1],
      ["F#5", 1],
      ["E5", 1.5],
      ["D5", 0.5],
      ["D5", 2],
    ],
    bass: [
      ["D3", 2],
      ["-", 2],
      ["D3", 2],
      ["-", 2],
      ["A2", 2],
      ["-", 2],
      ["D3", 2],
      ["-", 2],
      ["G2", 2],
      ["-", 2],
      ["D3", 2],
      ["-", 2],
      ["A2", 2],
      ["-", 2],
      ["D3", 2],
      ["-", 2],
      ["D3", 2],
      ["-", 2],
      ["D3", 2],
      ["-", 2],
      ["A2", 2],
      ["-", 2],
      ["D3", 2],
      ["-", 2],
      ["G2", 2],
      ["-", 2],
      ["D3", 2],
      ["-", 2],
      ["A2", 2],
      ["-", 2],
      ["D3", 2],
      ["-", 2],
    ],
  },
];

// ---------------------------------------------------------------------------
// Offline synth: per-instrument lead voices (piano / harp / violin / guitar,
// additive partials + per-voice envelopes + bowed vibrato) over a warm
// cello-ish bass, ADSR envelopes, simple feedback delay for air, then a
// vintage treatment (low-pass warmth, wow & flutter, faint hiss). Fully
// deterministic — no RNG.
// ---------------------------------------------------------------------------

function adsrPluck(t, dur, voice) {
  const attack = voice.attack;
  const relStart = Math.max(attack, dur - voice.release);
  let amp;
  if (t < attack) amp = t / attack;
  else if (t >= relStart) amp = Math.max(0, 1 - (t - relStart) / voice.release);
  else amp = 1;
  // Struck/plucked instruments keep ringing down exponentially through the
  // note; long notes decay to a near-silence tail (musically correct).
  return amp * Math.exp(-voice.decay * t);
}

function adsrBow(t, dur, voice) {
  const attack = voice.attack;
  const relStart = Math.max(attack, dur - voice.release);
  let amp;
  if (t < attack)
    amp = (t / attack) ** 2; // smooth bow onset
  else if (t >= relStart) amp = Math.max(0, 1 - (t - relStart) / voice.release);
  else amp = 1;
  // Gentle arch swell over the note (bow pressure feel)
  return amp * (1 + 0.08 * Math.sin(Math.min(1, t / dur) * Math.PI));
}

function renderNotes(notes, tempo, seconds, instrument, kind) {
  const buffer = new Float64Array(Math.ceil(seconds * SAMPLE_RATE));
  const beat = 60 / tempo;
  const voice = kind === "lead" ? INSTRUMENTS[instrument] : BASS_VOICE;
  let cursor = 0;
  for (const [name, beats] of notes) {
    const dur = beats * beat;
    if (name !== "-") {
      const baseF = freq(midi(name));
      const gain = kind === "lead" ? 0.26 : 0.13;
      const start = Math.floor(cursor * SAMPLE_RATE);
      const end = Math.min(buffer.length, Math.floor((cursor + dur) * SAMPLE_RATE));
      for (let i = start; i < end; i++) {
        const t = (i - start) / SAMPLE_RATE;
        let f = baseF;
        if (voice.vibrato) {
          // Bowed pitch wobble that enters partway into the note
          const onset = Math.max(0, (t - voice.vibrato.onset * dur) / dur);
          f *= Math.pow(2, (voice.vibrato.cents / 1200) * Math.sin(2 * Math.PI * voice.vibrato.rate * t) * onset);
        }
        const env =
          voice.decay > 0
            ? adsrPluck(t, dur, voice) * (kind === "lead" ? 1 - 0.15 * (t / dur) : 1)
            : adsrBow(t, dur, voice);
        let sample = 0;
        for (const [ratio, pgain] of voice.partials) {
          sample += Math.sin(2 * Math.PI * f * ratio * t) * pgain;
        }
        buffer[i] += sample * gain * env;
      }
    }
    cursor += dur;
  }
  return buffer;
}

function mixDown(lead, bass) {
  const out = new Float64Array(lead.length);
  for (let i = 0; i < out.length; i++) {
    // Gentle soft-clip + very light feedback delay for air
    const delayIdx = i - Math.floor(SAMPLE_RATE * 0.09);
    const delayed = delayIdx >= 0 ? lead[delayIdx] * 0.16 : 0;
    out[i] = Math.tanh((lead[i] + bass[i]) * 1.2 + delayed);
  }
  return out;
}

function frac(x) {
  return x - Math.floor(x);
}

// vintage(): the "old" character (user rule, 2026-10-01) — one-pole low-pass
// (~6.5 kHz) for tape warmth, subtle wow & flutter via a delay-modulated
// readout, soft tanh saturation and a faint deterministic hiss floor. No RNG:
// the hiss is a hashed sine sequence, constant across runs.
function vintage(samples) {
  const out = new Float64Array(samples.length);
  const lp = 1 - Math.exp((-2 * Math.PI * 6500) / SAMPLE_RATE);
  let state = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    // wow ±0.35 ms @ 0.6 Hz + flutter ±0.12 ms @ 5.2 Hz
    const d = 0.00035 * Math.sin(2 * Math.PI * 0.6 * t) + 0.00012 * Math.sin(2 * Math.PI * 5.2 * t);
    const di = i - Math.floor(SAMPLE_RATE * 0.02 - d * SAMPLE_RATE);
    const delayed = di >= 0 ? samples[di] : 0;
    const x = samples[i] * 0.92 + delayed * 0.08;
    state += lp * (x - state);
    const noise = frac(Math.sin(i * 12.9898) * 43758.5453) * 2 - 1;
    out[i] = Math.tanh(state * 1.15 + noise * 0.0018);
  }
  return out;
}

function toWav(samples) {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return Buffer.from(buffer);
}

function seconds(notes, tempo) {
  const beat = 60 / tempo;
  return notes.reduce((acc, [, beats]) => acc + beats * beat, 0);
}

function halfByBeats(notes) {
  // The second half of a note sequence, split by total beat count — used to
  // arrange a "full pass + second-half reprise" that lands closer to the
  // ~60 s target than a full double repeat would.
  const total = notes.reduce((acc, [, b]) => acc + b, 0);
  let acc = 0;
  const out = [];
  for (const note of notes) {
    acc += note[1];
    if (acc > total / 2) out.push(note);
  }
  return out;
}

function renderPiece(piece) {
  const tail = 1.5;
  // Target ~60 s (user rule 2026-10-01: each piece about a minute): repeat the
  // (public-domain) theme within the single rendered asset — the runtime never
  // loops the file. For short themes a full pass + second-half reprise often
  // lands closer to the target than a full double repeat.
  const base = Math.max(seconds(piece.melody, piece.tempo), seconds(piece.bass, piece.tempo));
  const n = Math.max(1, Math.round(60 / base));
  const useHalf = n >= 2 && Math.abs((n - 0.5) * base - 60) < Math.abs(n * base - 60);
  const repeats = useHalf ? n - 0.5 : n;
  const passes = Array.from({ length: Math.floor(repeats) });
  const melody = (
    useHalf ? [...passes.map(() => piece.melody), halfByBeats(piece.melody)] : passes.map(() => piece.melody)
  ).flat();
  const bass = (
    useHalf ? [...passes.map(() => piece.bass), halfByBeats(piece.bass)] : passes.map(() => piece.bass)
  ).flat();
  const duration = Math.max(seconds(melody, piece.tempo), seconds(bass, piece.tempo)) + tail;
  const lead = renderNotes(melody, piece.tempo, duration, piece.instrument, "lead");
  const bassBuf = renderNotes(bass, piece.tempo, duration, piece.instrument, "bass");
  return vintage(mixDown(lead, bassBuf));
}

function main() {
  const encode = process.argv.includes("--encode");
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const piece of PIECES) {
    const samples = renderPiece(piece);
    const tmp = `/tmp/${piece.slug}.wav`;
    writeFileSync(tmp, toWav(samples));
    if (encode) {
      const out = `${OUTPUT_DIR}/${piece.slug}.mp3`;
      execFileSync(
        "ffmpeg",
        [
          "-y",
          "-loglevel",
          "error",
          "-i",
          tmp,
          "-codec:a",
          "libmp3lame",
          "-b:a",
          "96k",
          "-ar",
          "44100",
          "-metadata",
          `artist=farukylmz0505`,
          "-metadata",
          `title=${piece.title} — Book Shelf Annual Summary`,
          "-metadata",
          "album=Book Shelf — Annual Summary Audio",
          "-metadata",
          `composer=${piece.composer}`,
          "-metadata",
          "license=CC0 1.0 Universal — rendered performance dedicated to the public domain",
          "-metadata",
          `comment=Public-domain composition (${piece.composer}, d. ${piece.composerDied}). Transcription and CC0 render by farukylmz0505.`,
          out,
        ],
        { stdio: "inherit" },
      );
      console.log(`rendered ${out}`);
    } else {
      console.log(`wrote ${tmp} (${(samples.length / SAMPLE_RATE).toFixed(1)}s)`);
    }
  }
}

main();
