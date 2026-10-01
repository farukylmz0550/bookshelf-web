// SPDX-License-Identifier: GPL-3.0-only
// Annual-summary background music (v2.7.0).
//
// Licensing: all compositions are public domain (composers died more than 70
// years ago); the note transcriptions and the pre-rendered audio performances
// are dedicated to the public domain via CC0 1.0 (see LICENSE-CC0 and
// public/audio/annual/README.md).
//
// The user can NEVER choose the piece: the app deterministically maps the
// user's yearly-goal progress to a mood tier, then picks a piece within that
// tier by year hash. Same year + same progress bucket → same piece.
//
// Mood ladder (user rule, 2026-10-01) — finer tiers as the goal gets closer:
//   < 25%  → sad          25–49% → hopeful      50–74% → neutral
//   75–99% → happy        exactly 100% → happier
//   over 100% (goal exceeded) → celebration

export type AnnualPieceMood = "sad" | "hopeful" | "neutral" | "happy" | "happier" | "celebration";

export type AnnualPiece = {
  slug: string;
  title: string;
  composer: string;
  composerDied: number;
  mood: AnnualPieceMood;
  /** Public asset path, e.g. /audio/annual/mozart-eine-kleine-nachtmusik.mp3 */
  src: string;
};

export const ANNUAL_PIECES: AnnualPiece[] = [
  {
    slug: "chopin-nocturne-op9-no2",
    title: "Nocturne in E-flat major, Op. 9 No. 2",
    composer: "Frédéric Chopin",
    composerDied: 1849,
    mood: "sad",
    src: "/audio/annual/chopin-nocturne-op9-no2.mp3",
  },
  {
    slug: "beethoven-moonlight-sonata-i",
    title: "Piano Sonata No. 14 'Moonlight', I. Adagio sostenuto",
    composer: "Ludwig van Beethoven",
    composerDied: 1827,
    mood: "sad",
    src: "/audio/annual/beethoven-moonlight-sonata-i.mp3",
  },
  {
    slug: "petzold-minuet-in-g",
    title: "Minuet in G major, BWV Anh. 114",
    composer: "Christian Petzold (attr. J. S. Bach)",
    composerDied: 1750,
    mood: "neutral",
    src: "/audio/annual/petzold-minuet-in-g.mp3",
  },
  {
    slug: "beethoven-fur-elise",
    title: "Für Elise, WoO 59",
    composer: "Ludwig van Beethoven",
    composerDied: 1827,
    mood: "hopeful",
    src: "/audio/annual/beethoven-fur-elise.mp3",
  },
  {
    slug: "mozart-eine-kleine-nachtmusik",
    title: "Eine kleine Nachtmusik, K. 525 (Allegro)",
    composer: "Wolfgang Amadeus Mozart",
    composerDied: 1791,
    mood: "happy",
    src: "/audio/annual/mozart-eine-kleine-nachtmusik.mp3",
  },
  {
    slug: "mozart-rondo-alla-turca",
    title: "Rondo alla Turca (Piano Sonata No. 11, K. 331)",
    composer: "Wolfgang Amadeus Mozart",
    composerDied: 1791,
    mood: "happy",
    src: "/audio/annual/mozart-rondo-alla-turca.mp3",
  },
  {
    slug: "vivaldi-spring-allegro",
    title: "La Primavera (The Four Seasons), I. Allegro",
    composer: "Antonio Vivaldi",
    composerDied: 1741,
    mood: "happy",
    src: "/audio/annual/vivaldi-spring-allegro.mp3",
  },
  {
    slug: "tchaikovsky-swan-lake-theme",
    title: "Swan Lake, Op. 20 (Theme)",
    composer: "Pyotr Ilyich Tchaikovsky",
    composerDied: 1893,
    mood: "sad",
    src: "/audio/annual/tchaikovsky-swan-lake-theme.mp3",
  },
  {
    slug: "beethoven-ode-to-joy",
    title: "Ode to Joy (Symphony No. 9, Op. 125)",
    composer: "Ludwig van Beethoven",
    composerDied: 1827,
    mood: "celebration",
    src: "/audio/annual/beethoven-ode-to-joy.mp3",
  },
];

/**
 * Map yearly goal progress to a mood tier (user rule, 2026-10-01): the closer
 * the books-read count gets to the yearly goal, the happier the music —
 * < 25% sad · 25–49% hopeful · 50–74% neutral · 75–99% happy · exactly the
 * goal → happier · beyond the goal → the celebration piece.
 * No yearly goal → neutral.
 */
export function moodForProgress(booksRead: number, yearlyTarget: number): AnnualPieceMood {
  if (yearlyTarget <= 0) return "neutral";
  const ratio = booksRead / yearlyTarget;
  if (ratio > 1) return "celebration";
  if (ratio >= 1) return "happier";
  if (ratio >= 0.75) return "happy";
  if (ratio >= 0.5) return "neutral";
  if (ratio >= 0.25) return "hopeful";
  return "sad";
}

/**
 * Deterministic piece selection: the mood pool is picked by year hash so the
 * same year + same progress bucket always yields the same piece.
 */
export function pieceForYear(year: number, booksRead: number, yearlyTarget: number): AnnualPiece {
  const mood = moodForProgress(booksRead, yearlyTarget);
  const pool = ANNUAL_PIECES.filter((p) => p.mood === mood);
  return pool[year % pool.length];
}
